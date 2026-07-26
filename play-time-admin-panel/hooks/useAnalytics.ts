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
  venueIds?: string[] | null;
}

export const useAnalytics = (options: UseAnalyticsOptions) => {
  const { dateRange, includePreviousPeriod = true, realtime = false, venueIds = null } = options;
  
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
  const venueScope = useMemo(() => venueIds ? new Set(venueIds) : null, [venueIds?.join('|')]);
  const scopedBookings = useMemo(
    () => venueScope ? bookings.filter((booking) => venueScope.has(booking.venueId)) : bookings,
    [bookings, venueScope]
  );
  const scopedPreviousBookings = useMemo(
    () => venueScope
      ? previousBookings.filter((booking) => venueScope.has(booking.venueId))
      : previousBookings,
    [previousBookings, venueScope]
  );
  const scopedVenues = useMemo(
    () => venueScope ? venues.filter((venue) => venueScope.has(venue.id)) : venues,
    [venues, venueScope]
  );
  const scopedUserIds = useMemo(
    () => new Set([
      ...scopedBookings.map((booking) => booking.userId),
      ...memberships
        .filter((membership) => !venueScope || venueScope.has(membership.venueId))
        .map((membership) => membership.userId),
    ]),
    [scopedBookings, memberships, venueScope]
  );
  const scopedUsers = useMemo(
    () => venueScope ? users.filter((user) => scopedUserIds.has(user.id)) : users,
    [users, scopedUserIds, venueScope]
  );
  
  const loading = bookingsLoading || usersLoading || venuesLoading || membershipsLoading || 
                  (includePreviousPeriod && (previousBookingsLoading || previousUsersLoading));
  
  // Calculate revenue trends
  const revenueTrends = useMemo<RevenueTrend[]>(() => {
    return calculateRevenueTrends(
      scopedBookings,
      dateRange,
      previousPeriod,
      scopedPreviousBookings
    );
  }, [scopedBookings, dateRange, previousPeriod, scopedPreviousBookings]);
  
  // Calculate user growth
  const userGrowth = useMemo<UserGrowth[]>(() => {
    return calculateUserGrowth(
      scopedUsers,
      dateRange,
      previousPeriod,
      venueScope ? previousUsers.filter((user) => scopedUserIds.has(user.id)) : previousUsers
    );
  }, [scopedUsers, dateRange, previousPeriod, previousUsers, venueScope, scopedUserIds]);
  
  // Calculate venue performance
  const venuePerformance = useMemo<VenuePerformance[]>(() => {
    return calculateVenuePerformance(
      scopedBookings,
      scopedVenues,
      dateRange,
      previousPeriod,
      scopedPreviousBookings
    );
  }, [scopedBookings, scopedVenues, dateRange, previousPeriod, scopedPreviousBookings]);
  
  // Calculate booking patterns
  const bookingPatternsByHour = useMemo<BookingPattern[]>(() => {
    return calculateBookingPatternsByHour(scopedBookings);
  }, [scopedBookings]);
  
  const bookingPatternsByDay = useMemo<DayOfWeekPattern[]>(() => {
    return calculateBookingPatternsByDay(scopedBookings);
  }, [scopedBookings]);
  
  const bookingPatternsBySport = useMemo<SportTypePattern[]>(() => {
    return calculateBookingPatternsBySport(scopedBookings);
  }, [scopedBookings]);
  
  // Calculate period comparison
  const periodComparison = useMemo(() => {
    if (!includePreviousPeriod || scopedPreviousBookings.length === 0) {
      return null;
    }
    return calculatePeriodComparison(scopedBookings, scopedPreviousBookings);
  }, [scopedBookings, scopedPreviousBookings, includePreviousPeriod]);
  
  return {
    // Data
    bookings: scopedBookings,
    users: scopedUsers,
    venues: scopedVenues,
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

