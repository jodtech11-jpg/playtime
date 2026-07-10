import { useMemo } from 'react';
import { useBookings } from './useBookings';
import { useMemberships } from './useMemberships';
import { useVenues } from './useVenues';
import { Transaction } from '../types';

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

// Derived (not persisted) transactions share the global Transaction shape so
// pages and export utils can consume them; `date` is kept for sorting/display.
type FinancialTransaction = Transaction & { date?: any };

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

  // Memberships that count towards financials: Active, not refunded, paid (or
  // legacy docs without paymentStatus), and within the selected date range.
  const relevantMemberships = useMemo(() => {
    return memberships.filter(m => {
      if (m.status !== 'Active') return false;
      if (m.paymentStatus === 'Refunded') return false;
      if (m.paymentStatus !== undefined && m.paymentStatus !== 'Paid') return false;
      if (options.dateRange) {
        const raw = m.createdAt || m.startDate;
        if (!raw) return false;
        const date = raw?.toDate ? raw.toDate() : new Date(raw);
        if (isNaN(date.getTime())) return false;
        if (date < options.dateRange.start || date > options.dateRange.end) return false;
      }
      return true;
    });
  }, [memberships, options.dateRange]);

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

    // Booking commission (5%) + membership commission (5%) — same sets as the ledger rows
    const bookingCommission = grossBookingValue * PLATFORM_COMMISSION_RATE;
    const membershipCommission = relevantMemberships.reduce(
      (sum, m) => sum + (m.price || 0) * PLATFORM_COMMISSION_RATE,
      0
    );
    const platformCommission = bookingCommission + membershipCommission;

    // Convenience fees: ₹100 per first-time booking (same rule as ledger rows and settlements)
    const convenienceFees = confirmedBookings.reduce(
      (sum, b) => sum + (b.isFirstTimeBooking === true ? CONVENIENCE_FEE : 0),
      0
    );

    // Calculate venue payouts (gross - booking commission - convenience fees)
    const pendingVenuePayouts = grossBookingValue - bookingCommission - convenienceFees;

    // Calculate total transactions
    const totalTransactions = confirmedBookings.length + relevantMemberships.length;

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
  }, [bookings, relevantMemberships]);

  // Generate transactions list
  const transactions = useMemo<FinancialTransaction[]>(() => {
    const transactionList: FinancialTransaction[] = [];

    // Add booking transactions
    bookings
      .filter(b => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
      .forEach(booking => {
        const venue = venues.find(v => v.id === booking.venueId);
        const commission = (booking.amount || 0) * PLATFORM_COMMISSION_RATE;
        // Convenience fee only applies to first-time bookings (matches settlement logic)
        const convenienceFee = booking.isFirstTimeBooking === true ? CONVENIENCE_FEE : 0;
        const venuePayout = (booking.amount || 0) - commission - convenienceFee;
        const netPlatform = commission + convenienceFee;

        transactionList.push({
          id: booking.id,
          type: 'Booking',
          source: venue?.name || booking.venueId,
          sourceId: booking.venueId,
          amount: booking.amount || 0,
          platformCommission: commission,
          convenienceFee: convenienceFee,
          venuePayout: venuePayout,
          netPlatform: netPlatform,
          status: 'Completed',
          bookingId: booking.id,
          date: booking.createdAt || booking.startTime,
          createdAt: booking.createdAt || booking.startTime,
          invoiceId: `#INV-${booking.id.substring(0, 8).toUpperCase()}`
        });
      });

    // Add membership transactions (5% commission)
    relevantMemberships
      .forEach(membership => {
        const venue = venues.find(v => v.id === membership.venueId);
        const commission = membership.price * PLATFORM_COMMISSION_RATE;
        const venuePayout = membership.price - commission;
        const netPlatform = commission;

        transactionList.push({
          id: membership.id,
          type: 'Membership',
          source: venue?.name || membership.venueId,
          sourceId: membership.venueId,
          amount: membership.price,
          platformCommission: commission,
          venuePayout: venuePayout,
          netPlatform: netPlatform,
          status: 'Completed',
          membershipId: membership.id,
          date: membership.createdAt || membership.startDate,
          createdAt: membership.createdAt || membership.startDate,
          invoiceId: `#INV-MEM-${membership.id.substring(0, 8).toUpperCase()}`
        });
      });

    // Sort by date (newest first)
    return transactionList.sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [bookings, relevantMemberships, venues]);

  return {
    metrics,
    transactions,
    loading,
    bookings,
    memberships
  };
};

