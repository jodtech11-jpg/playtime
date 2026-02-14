/**
 * Razorpay Webhook Handler
 * 
 * This file contains webhook handling logic for Razorpay payment events.
 * In a production environment, this should be implemented as a backend API endpoint.
 * 
 * For now, this serves as a reference for webhook event handling.
 */

import { createOnlinePayment } from './paymentService';
import { bookingsCollection, membershipsCollection } from './firebase';
import { Booking, Membership } from '../types';
import { serverTimestamp } from 'firebase/firestore';

/**
 * Razorpay webhook event types
 */
export enum RazorpayWebhookEvent {
  PAYMENT_AUTHORIZED = 'payment.authorized',
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_FAILED = 'payment.failed',
  ORDER_PAID = 'order.paid',
  REFUND_CREATED = 'refund.created',
  REFUND_PROCESSED = 'refund.processed',
}

/**
 * Razorpay webhook payload structure
 */
interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        currency: string;
        status: string;
        order_id: string;
        invoice_id?: string;
        international: boolean;
        method: string;
        amount_refunded: number;
        refund_status?: string;
        captured: boolean;
        description: string;
        card_id?: string;
        bank?: string;
        wallet?: string;
        vpa?: string;
        email: string;
        contact: string;
        notes: Record<string, string>;
        fee?: number;
        tax?: number;
        error_code?: string;
        error_description?: string;
        error_source?: string;
        error_step?: string;
        error_reason?: string;
        acquirer_data?: Record<string, any>;
        created_at: number;
      };
    };
    order?: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        amount_paid: number;
        amount_due: number;
        currency: string;
        receipt: string;
        offer_id?: string;
        status: string;
        attempts: number;
        notes: Record<string, string>;
        created_at: number;
      };
    };
  };
  created_at: number;
}

/**
 * Verify Razorpay webhook signature
 * IMPORTANT: This should be done on the backend with the webhook secret
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  // This verification should be done on the backend
  // Using crypto library for HMAC verification
  // 
  // Example (Node.js):
  // const crypto = require('crypto');
  // const expectedSignature = crypto
  //   .createHmac('sha256', secret)
  //   .update(payload)
  //   .digest('hex');
  // return expectedSignature === signature;
  
  // For now, return true - backend should handle this
  return true;
};

/**
 * Handle Razorpay webhook events
 * This should be called from a backend API endpoint
 */
export const handleRazorpayWebhook = async (
  payload: RazorpayWebhookPayload,
  signature: string,
  webhookSecret: string
): Promise<void> => {
  // Verify webhook signature (should be done on backend)
  if (!verifyWebhookSignature(JSON.stringify(payload), signature, webhookSecret)) {
    throw new Error('Invalid webhook signature');
  }

  const event = payload.event;
  const payment = payload.payload.payment?.entity;

  if (!payment) {
    console.warn('Webhook payload missing payment entity');
    return;
  }

  // Extract booking/membership ID from notes
  const bookingId = payment.notes?.bookingId;
  const membershipId = payment.notes?.membershipId;

  switch (event) {
    case RazorpayWebhookEvent.PAYMENT_CAPTURED:
    case RazorpayWebhookEvent.ORDER_PAID:
      // Payment successful
      if (bookingId) {
        await handleBookingPaymentSuccess(bookingId, payment.id, payment.amount / 100);
      } else if (membershipId) {
        await handleMembershipPaymentSuccess(membershipId, payment.id, payment.amount / 100);
      }
      break;

    case RazorpayWebhookEvent.PAYMENT_FAILED:
      // Payment failed
      if (bookingId) {
        await handleBookingPaymentFailure(bookingId, payment.id, payment.error_description || 'Payment failed');
      } else if (membershipId) {
        await handleMembershipPaymentFailure(membershipId, payment.id, payment.error_description || 'Payment failed');
      }
      break;

    case RazorpayWebhookEvent.REFUND_CREATED:
    case RazorpayWebhookEvent.REFUND_PROCESSED:
      // Handle refunds
      if (bookingId) {
        await handleBookingRefund(bookingId, payment.id, payment.amount_refunded / 100);
      } else if (membershipId) {
        await handleMembershipRefund(membershipId, payment.id, payment.amount_refunded / 100);
      }
      break;

    default:
      console.log(`Unhandled webhook event: ${event}`);
  }
};

/**
 * Handle successful booking payment
 */
const handleBookingPaymentSuccess = async (
  bookingId: string,
  paymentId: string,
  amount: number
): Promise<void> => {
  try {
    const booking = await bookingsCollection.get(bookingId) as Booking | null;
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Create payment record
    await createOnlinePayment(booking, paymentId, 'Razorpay');
  } catch (error: any) {
    console.error('Error handling booking payment success:', error);
    throw error;
  }
};

/**
 * Handle failed booking payment
 */
const handleBookingPaymentFailure = async (
  bookingId: string,
  paymentId: string,
  errorMessage: string
): Promise<void> => {
  try {
    await bookingsCollection.update(bookingId, {
      paymentStatus: 'Pending',
      updatedAt: serverTimestamp()
    });
    // Log payment failure for admin review
    console.error(`Booking payment failed: ${bookingId}, Payment ID: ${paymentId}, Error: ${errorMessage}`);
  } catch (error: any) {
    console.error('Error handling booking payment failure:', error);
    throw error;
  }
};

/**
 * Handle successful membership payment
 */
const handleMembershipPaymentSuccess = async (
  membershipId: string,
  paymentId: string,
  amount: number
): Promise<void> => {
  try {
    const membership = await membershipsCollection.get(membershipId) as Membership | null;
    if (!membership) {
      throw new Error('Membership not found');
    }

    // Create payment record
    await createOnlinePayment(membership, paymentId, 'Razorpay');
  } catch (error: any) {
    console.error('Error handling membership payment success:', error);
    throw error;
  }
};

/**
 * Handle failed membership payment
 */
const handleMembershipPaymentFailure = async (
  membershipId: string,
  paymentId: string,
  errorMessage: string
): Promise<void> => {
  try {
    await membershipsCollection.update(membershipId, {
      paymentStatus: 'Pending',
      updatedAt: serverTimestamp()
    });
    // Log payment failure for admin review
    console.error(`Membership payment failed: ${membershipId}, Payment ID: ${paymentId}, Error: ${errorMessage}`);
  } catch (error: any) {
    console.error('Error handling membership payment failure:', error);
    throw error;
  }
};

/**
 * Handle booking refund
 */
const handleBookingRefund = async (
  bookingId: string,
  paymentId: string,
  refundAmount: number
): Promise<void> => {
  try {
    // Update booking payment status to refunded
    await bookingsCollection.update(bookingId, {
      paymentStatus: 'Refunded',
      updatedAt: serverTimestamp()
    });
    // TODO: Create refund record in payments collection
    console.log(`Booking refund processed: ${bookingId}, Amount: ${refundAmount}`);
  } catch (error: any) {
    console.error('Error handling booking refund:', error);
    throw error;
  }
};

/**
 * Handle membership refund
 */
const handleMembershipRefund = async (
  membershipId: string,
  paymentId: string,
  refundAmount: number
): Promise<void> => {
  try {
    // Update membership payment status to refunded
    await membershipsCollection.update(membershipId, {
      paymentStatus: 'Refunded',
      updatedAt: serverTimestamp()
    });
    // TODO: Create refund record in payments collection
    console.log(`Membership refund processed: ${membershipId}, Amount: ${refundAmount}`);
  } catch (error: any) {
    console.error('Error handling membership refund:', error);
    throw error;
  }
};

