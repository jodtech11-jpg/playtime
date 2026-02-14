/**
 * Payment Service
 * Handles payment record creation and settlement management
 */

import { paymentsCollection, settlementsCollection, invoicesCollection, bookingsCollection, membershipsCollection, getDocument } from './firebase';
import { Payment, Settlement, Booking, Membership, Invoice, Venue, AppSettings } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { initiateBookingPayment, initiateMembershipPayment, isRazorpayEnabled } from './razorpayService';

/**
 * Helper to fetch platform settings for calculations
 */
const getPlatformSettings = async () => {
  try {
    const settings = await getDocument<AppSettings>('appSettings', 'platform');
    return {
      commissionRate: settings?.platformCommission !== undefined ? settings.platformCommission / 100 : 0.05,
      convenienceFee: settings?.convenienceFee !== undefined ? settings.convenienceFee : 100
    };
  } catch (error) {
    console.warn('Failed to fetch platform settings, using defaults');
    return { commissionRate: 0.05, convenienceFee: 100 };
  }
};

/**
 * Create payment record for online payment (User → Venue)
 */
export const createOnlinePayment = async (
  bookingOrMembership: Booking | Membership,
  transactionId: string,
  paymentGateway: 'Razorpay' | 'Other' = 'Razorpay'
): Promise<void> => {
  const isBooking = 'courtId' in bookingOrMembership;
  const amount = isBooking
    ? (bookingOrMembership as Booking).amount
    : (bookingOrMembership as Membership).price;

  const payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> = {
    type: 'Online',
    direction: 'UserToVenue',
    sourceType: isBooking ? 'Booking' : 'Membership',
    sourceId: bookingOrMembership.id,
    userId: bookingOrMembership.userId,
    venueId: bookingOrMembership.venueId,
    amount,
    paymentMethod: paymentGateway,
    paymentGateway,
    transactionId,
    status: 'Completed',
    paymentDate: serverTimestamp()
  };

  await paymentsCollection.create(payment);

  // If this is a booking, create settlement record for venue to pay platform
  if (isBooking) {
    await createSettlementForBooking(bookingOrMembership as Booking, transactionId);
  } else {
    await createSettlementForMembership(bookingOrMembership as Membership, transactionId);
  }
};

/**
 * Create settlement record for booking
 */
const createSettlementForBooking = async (booking: Booking, paymentTransactionId: string): Promise<void> => {
  const settings = await getPlatformSettings();
  const commission = (booking.amount || 0) * settings.commissionRate;
  const convenienceFee = booking.isFirstTimeBooking ? settings.convenienceFee : 0;
  const gatewayFee = commission * 0.06; // 6% of commission (estimated)
  const netAmount = commission + convenienceFee - gatewayFee;

  // Create invoice first
  const invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
    invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    type: 'Commission',
    source: booking.venueId, // Will be replaced with venue name
    sourceId: booking.venueId,
    amount: netAmount,
    breakdown: {
      gross: booking.amount || 0,
      commission,
      convenienceFee,
      gatewayFee,
      net: netAmount
    },
    status: 'Sent',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  };

  const createdInvoice = await invoicesCollection.create(invoice);

  // Create settlement
  const settlement: Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'> = {
    venueId: booking.venueId,
    venueName: '', // Will be populated by hook
    invoiceId: createdInvoice,
    invoiceNumber: invoice.invoiceNumber,
    amount: netAmount,
    breakdown: {
      commission,
      convenienceFee,
      gatewayFee,
      net: netAmount
    },
    status: 'Pending',
    dueDate: invoice.dueDate
  };

  await settlementsCollection.create(settlement);
};

/**
 * Create settlement record for membership
 */
const createSettlementForMembership = async (membership: Membership, paymentTransactionId: string): Promise<void> => {
  const settings = await getPlatformSettings();
  const commission = membership.price * settings.commissionRate;
  const gatewayFee = commission * 0.06; // 6% of commission (estimated)
  const netAmount = commission - gatewayFee;

  // Create invoice first
  const invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
    invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    type: 'Commission',
    source: membership.venueId,
    sourceId: membership.venueId,
    amount: netAmount,
    breakdown: {
      gross: membership.price,
      commission,
      gatewayFee,
      net: netAmount
    },
    status: 'Sent',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  };

  const createdInvoice = await invoicesCollection.create(invoice);

  // Create settlement
  const settlement: Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'> = {
    venueId: membership.venueId,
    venueName: '', // Will be populated by hook
    invoiceId: createdInvoice,
    invoiceNumber: invoice.invoiceNumber,
    amount: netAmount,
    breakdown: {
      commission,
      convenienceFee: 0, // No convenience fee for memberships
      gatewayFee,
      net: netAmount
    },
    status: 'Pending',
    dueDate: invoice.dueDate
  };

  await settlementsCollection.create(settlement);
};

/**
 * Create offline payment record (Venue → Platform)
 * Called when Super Admin confirms settlement payment
 */
export const createOfflinePayment = async (
  settlement: Settlement,
  paymentData: {
    paymentMethod: Settlement['paymentMethod'];
    paymentReference?: string;
    paymentDate: Date;
    receiptUrl?: string;
    confirmedBy: string;
  }
): Promise<void> => {
  const payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> = {
    type: 'Offline',
    direction: 'VenueToPlatform',
    sourceType: 'Settlement',
    sourceId: settlement.id,
    venueId: settlement.venueId,
    amount: settlement.amount,
    paymentMethod: paymentData.paymentMethod,
    transactionId: paymentData.paymentReference,
    status: 'Completed',
    paymentDate: paymentData.paymentDate,
    confirmedBy: paymentData.confirmedBy,
    confirmedAt: serverTimestamp(),
    receiptUrl: paymentData.receiptUrl
  };

  await paymentsCollection.create(payment);
};

/**
 * Initiate Razorpay payment for booking
 * Opens Razorpay checkout and handles payment flow
 */
export const processBookingPayment = async (
  booking: Booking,
  venue: Venue,
  userDetails: { name?: string; email?: string; phone?: string },
  onSuccess: () => void,
  onError: (error: string) => void
): Promise<void> => {
  // Check if Razorpay is enabled for this venue
  if (!isRazorpayEnabled(venue)) {
    onError('Razorpay is not enabled for this venue. Please contact the venue manager.');
    return;
  }

  // Initiate payment
  await initiateBookingPayment(
    booking,
    venue,
    userDetails,
    async (paymentId: string, orderId?: string) => {
      try {
        // Payment successful - create payment record
        await createOnlinePayment(booking, paymentId, 'Razorpay');
        onSuccess();
      } catch (error: any) {
        console.error('Error recording payment:', error);
        onError('Payment successful but failed to record. Please contact support.');
      }
    },
    (error: string) => {
      onError(error);
    }
  );
};

/**
 * Initiate Razorpay payment for membership
 * Opens Razorpay checkout and handles payment flow
 */
export const processMembershipPayment = async (
  membership: Membership,
  venue: Venue,
  userDetails: { name?: string; email?: string; phone?: string },
  onSuccess: () => void,
  onError: (error: string) => void
): Promise<void> => {
  // Check if Razorpay is enabled for this venue
  if (!isRazorpayEnabled(venue)) {
    onError('Razorpay is not enabled for this venue. Please contact the venue manager.');
    return;
  }

  // Initiate payment
  await initiateMembershipPayment(
    membership,
    venue,
    userDetails,
    async (paymentId: string, orderId?: string) => {
      try {
        // Payment successful - create payment record
        await createOnlinePayment(membership, paymentId, 'Razorpay');
        onSuccess();
      } catch (error: any) {
        console.error('Error recording payment:', error);
        onError('Payment successful but failed to record. Please contact support.');
      }
    },
    (error: string) => {
      onError(error);
    }
  );
};

