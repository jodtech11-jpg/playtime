import { useMemo } from 'react';
import { useBookings } from './useBookings';
import { useMemberships } from './useMemberships';
import { useVenues } from './useVenues';

interface UseFinancialsOptions {
  dateRange?: {
    start: Date;
    end: Date;
  };
  realtime?: boolean;
}

interface FinancialMetrics {
  grossBookingValue: number;
  platformCommission: number;
  convenienceFees: number;
  pendingVenuePayouts: number;
  totalTransactions: number;
  revenueTrend: number; // Percentage change
}

interface Transaction {
  id: string;
  type: 'Booking' | 'Membership' | 'Commission' | 'ConvenienceFee';
  source: string;
  amount: number;
  platformCommission?: number;
  convenienceFee?: number;
  venuePayout?: number;
  netPlatform?: number;
  status: string;
  date: any;
  invoiceId?: string;
}

const PLATFORM_COMMISSION_RATE = 0.05; // 5%
const CONVENIENCE_FEE = 100; // ₹100 for first-time bookings

export const useFinancials = (options: UseFinancialsOptions = {}) => {
  const { bookings, loading: bookingsLoading } = useBookings({
    dateRange: options.dateRange,
    realtime: options.realtime
  });
  
  const { memberships, loading: membershipsLoading } = useMemberships({
    realtime: options.realtime
  });
  
  const { venues, loading: venuesLoading } = useVenues({ realtime: options.realtime });

  const loading = bookingsLoading || membershipsLoading || venuesLoading;

  // Calculate financial metrics
  const metrics = useMemo<FinancialMetrics>(() => {
    // Filter confirmed and paid bookings
    const confirmedBookings = bookings.filter(
      b => b.status === 'Confirmed' && b.paymentStatus === 'Paid'
    );

    // Calculate gross booking value
    const grossBookingValue = confirmedBookings.reduce(
      (sum, b) => sum + (b.amount || 0),
      0
    );

    // Calculate platform commission (5% of bookings)
    const platformCommission = grossBookingValue * PLATFORM_COMMISSION_RATE;

    // Calculate convenience fees (₹100 per unique user — proxy for first-time booking).
    // Ideally this should be tracked per user's lifetime booking history across all venues.
    // Using unique users in the current dataset as a conservative approximation.
    const uniqueUserIds = new Set(confirmedBookings.map(b => b.userId).filter(Boolean));
    const convenienceFees = uniqueUserIds.size * CONVENIENCE_FEE;

    // Calculate venue payouts (gross - commission - convenience fees)
    const pendingVenuePayouts = grossBookingValue - platformCommission - convenienceFees;

    // Calculate total transactions
    const totalTransactions = confirmedBookings.length + memberships.filter(m => m.status === 'Active').length;

    // Calculate revenue trend (compare with previous period)
    // For now, we'll return 0 (can be enhanced with historical data)
    const revenueTrend = 0;

    return {
      grossBookingValue,
      platformCommission,
      convenienceFees,
      pendingVenuePayouts,
      totalTransactions,
      revenueTrend
    };
  }, [bookings, memberships]);

  // Generate transactions list
  const transactions = useMemo<Transaction[]>(() => {
    const transactionList: Transaction[] = [];

    // Build set of user IDs that appear more than once (repeat users — no convenience fee)
    const confirmedBookingsForFee = bookings.filter(b => b.status === 'Confirmed' && b.paymentStatus === 'Paid');
    const userBookingCount: Record<string, number> = {};
    confirmedBookingsForFee.forEach(b => {
      if (b.userId) userBookingCount[b.userId] = (userBookingCount[b.userId] || 0) + 1;
    });

    // Add booking transactions
    bookings
      .filter(b => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
      .forEach(booking => {
        const venue = venues.find(v => v.id === booking.venueId);
        const commission = (booking.amount || 0) * PLATFORM_COMMISSION_RATE;
        // Convenience fee only applies to first booking per user (count === 1 in this dataset)
        const isFirstBooking = booking.userId ? (userBookingCount[booking.userId] || 0) === 1 : false;
        const convenienceFee = isFirstBooking ? CONVENIENCE_FEE : 0;
        const venuePayout = (booking.amount || 0) - commission - convenienceFee;
        const netPlatform = commission + convenienceFee;

        transactionList.push({
          id: booking.id,
          type: 'Booking',
          source: venue?.name || booking.venueId,
          amount: booking.amount || 0,
          platformCommission: commission,
          convenienceFee: convenienceFee,
          venuePayout: venuePayout,
          netPlatform: netPlatform,
          status: 'Completed',
          date: booking.createdAt || booking.startTime,
          invoiceId: `#INV-${booking.id.substring(0, 8).toUpperCase()}`
        });
      });

    // Add membership transactions (5% commission)
    memberships
      .filter(m => m.status === 'Active')
      .forEach(membership => {
        const venue = venues.find(v => v.id === membership.venueId);
        const commission = membership.price * PLATFORM_COMMISSION_RATE;
        const venuePayout = membership.price - commission;
        const netPlatform = commission;

        transactionList.push({
          id: membership.id,
          type: 'Membership',
          source: venue?.name || membership.venueId,
          amount: membership.price,
          platformCommission: commission,
          venuePayout: venuePayout,
          netPlatform: netPlatform,
          status: 'Completed',
          date: membership.createdAt || membership.startDate,
          invoiceId: `#INV-MEM-${membership.id.substring(0, 8).toUpperCase()}`
        });
      });

    // Sort by date (newest first)
    return transactionList.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [bookings, memberships, venues]);

  return {
    metrics,
    transactions,
    loading,
    bookings,
    memberships
  };
};

