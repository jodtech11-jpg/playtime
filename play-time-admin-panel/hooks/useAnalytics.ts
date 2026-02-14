/**
 * Analytics Hook
 * Fetches data and calculates advanced analytics metrics
 */

import { useState, useEffect, useMemo } from 'react';
import { useBookings } from './useBookings';
import { useUsers } from './useUsers';
import { useVenues } from './useVenues';
import { useMemberships } from './useMemberships';
import {
  calculateRevenueTrends,
  calculateUserGrowth,
  calculateVenuePerformance,
  calculateBookingPatternsByHour,
  calculateBookingPatternsByDay,
  calculateBookingPatternsBySport,
  calculatePeriodComparison,
  getPreviousPeriod,
  RevenueTrend,
  UserGrowth,
  VenuePerformance,
  BookingPattern,
  DayOfWeekPattern,
  SportTypePattern
} from '../utils/analyticsUtils';

interface UseAnalyticsOptions {
  dateRange: { start: Date; end: Date };
  includePreviousPeriod?: boolean;
  realtime?: boolean;
}

export const useAnalytics = (options: UseAnalyticsOptions) => {
  const { dateRange, includePreviousPeriod = true, realtime = false } = options;
  
  // Fetch current period data
  const { bookings, loading: bookingsLoading } = useBookings({
    dateRange,
    realtime
  });
  
  const { users, loading: usersLoading } = useUsers({});
  const { venues, loading: venuesLoading } = useVenues({ realtime });
  const { memberships, loading: membershipsLoading } = useMemberships({ realtime });
  
  // Calculate previous period date range
  const previousPeriod = useMemo(() => {
    if (!includePreviousPeriod) return undefined;
    return getPreviousPeriod(dateRange);
  }, [dateRange, includePreviousPeriod]);
  
  // Fetch previous period data if needed
  const { bookings: previousBookings, loading: previousBookingsLoading } = useBookings({
    dateRange: previousPeriod,
    realtime: false
  });
  
  const { users: previousUsers, loading: previousUsersLoading } = useUsers({});
  
  const loading = bookingsLoading || usersLoading || venuesLoading || membershipsLoading || 
                  (includePreviousPeriod && (previousBookingsLoading || previousUsersLoading));
  
  // Calculate revenue trends
  const revenueTrends = useMemo<RevenueTrend[]>(() => {
    return calculateRevenueTrends(
      bookings,
      dateRange,
      previousPeriod,
      previousBookings
    );
  }, [bookings, dateRange, previousPeriod, previousBookings]);
  
  // Calculate user growth
  const userGrowth = useMemo<UserGrowth[]>(() => {
    return calculateUserGrowth(
      users,
      dateRange,
      previousPeriod,
      previousUsers
    );
  }, [users, dateRange, previousPeriod, previousUsers]);
  
  // Calculate venue performance
  const venuePerformance = useMemo<VenuePerformance[]>(() => {
    return calculateVenuePerformance(
      bookings,
      venues,
      dateRange,
      previousPeriod,
      previousBookings
    );
  }, [bookings, venues, dateRange, previousPeriod, previousBookings]);
  
  // Calculate booking patterns
  const bookingPatternsByHour = useMemo<BookingPattern[]>(() => {
    return calculateBookingPatternsByHour(bookings);
  }, [bookings]);
  
  const bookingPatternsByDay = useMemo<DayOfWeekPattern[]>(() => {
    return calculateBookingPatternsByDay(bookings);
  }, [bookings]);
  
  const bookingPatternsBySport = useMemo<SportTypePattern[]>(() => {
    return calculateBookingPatternsBySport(bookings);
  }, [bookings]);
  
  // Calculate period comparison
  const periodComparison = useMemo(() => {
    if (!includePreviousPeriod || previousBookings.length === 0) {
      return null;
    }
    return calculatePeriodComparison(bookings, previousBookings);
  }, [bookings, previousBookings, includePreviousPeriod]);
  
  return {
    // Data
    bookings,
    users,
    venues,
    memberships,
    previousBookings,
    previousUsers,
    
    // Analytics
    revenueTrends,
    userGrowth,
    venuePerformance,
    bookingPatternsByHour,
    bookingPatternsByDay,
    bookingPatternsBySport,
    periodComparison,
    
    // State
    loading,
    previousPeriod
  };
};

