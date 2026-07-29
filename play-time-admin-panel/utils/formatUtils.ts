/**
 * Formatting utility functions
 */

export const formatCurrency = (amount: number | null | undefined, currency: string = 'INR'): string => {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Short, human-readable booking reference from a Firestore document ID. */
export const formatBookingReference = (bookingId: string): string => {
  if (!bookingId) return '—';
  return `#${bookingId.slice(0, 8).toUpperCase()}`;
};

import { resolveSportName as resolveSportNameCore } from './sportUtils';

interface SportLookup {
  id: string;
  name: string;
}

/** Resolve a sport field that may store either a sport document ID or a display name. */
export const resolveSportName = (
  sportIdOrName: string | undefined,
  sports: SportLookup[] = []
): string => {
  if (!sportIdOrName) return '—';

  const name = resolveSportNameCore(sportIdOrName, sports);
  if (name !== sportIdOrName) return name;

  // Unresolved and looks like a Firestore document ID — don't show raw IDs in the UI
  if (/^[a-zA-Z0-9]{15,28}$/.test(sportIdOrName)) {
    return 'Unknown Sport';
  }

  return name;
};

interface BookingUserLookup {
  user?: string;
  userId?: string;
}

interface UserNameLookup {
  id: string;
  name?: string;
  email?: string;
}

/** Resolve a booking's customer display name from stored fields or a users lookup. */
export const resolveBookingUserName = (
  booking: BookingUserLookup,
  usersById: Record<string, UserNameLookup> = {}
): string => {
  if (booking.user?.trim()) return booking.user.trim();
  if (booking.userId === 'admin-walk-in') return 'Walk-in customer';
  if (booking.userId && usersById[booking.userId]) {
    const user = usersById[booking.userId];
    return user.name?.trim() || user.email?.trim() || 'Unknown user';
  }
  if (booking.userId) return '';
  return '—';
};

export const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    'Active': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    'Pending': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
    'Confirmed': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    'Cancelled': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
    'Completed': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    'Inactive': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' },
    'Expired': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' },
    'Paid': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    'Refunded': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  };

  return statusColors[status] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' };
};

