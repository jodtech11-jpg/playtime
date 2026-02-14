/**
 * Analytics Utilities
 * Functions for calculating advanced analytics and metrics
 */

import { Booking, User, Venue, Membership } from '../types';

export interface RevenueTrend {
  period: string;
  revenue: number;
  bookings: number;
  averageBookingValue: number;
  growth?: number; // Percentage change from previous period
}

export interface UserGrowth {
  period: string;
  newUsers: number;
  totalUsers: number;
  activeUsers: number;
  growth?: number; // Percentage change from previous period
}

export interface VenuePerformance {
  venueId: string;
  venueName: string;
  revenue: number;
  bookings: number;
  averageBookingValue: number;
  occupancyRate: number; // Percentage of available slots booked
  growth?: number; // Revenue growth from previous period
}

export interface BookingPattern {
  hour: number;
  hourLabel: string;
  bookings: number;
  revenue: number;
  averageValue: number;
}

export interface DayOfWeekPattern {
  day: string;
  dayIndex: number;
  bookings: number;
  revenue: number;
  averageValue: number;
}

export interface SportTypePattern {
  sport: string;
  bookings: number;
  revenue: number;
  averageValue: number;
  percentage: number; // Percentage of total bookings
}

/**
 * Calculate revenue trends for a date range with period comparisons
 */
export const calculateRevenueTrends = (
  bookings: Booking[],
  dateRange: { start: Date; end: Date },
  previousPeriod?: { start: Date; end: Date },
  previousBookings?: Booking[]
): RevenueTrend[] => {
  const trends: RevenueTrend[] = [];
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  
  // Determine interval based on date range length
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let interval = 1; // Daily
  let periodFormat: 'day' | 'week' | 'month' = 'day';
  
  if (diffDays > 90) {
    interval = 7; // Weekly
    periodFormat = 'week';
  } else if (diffDays > 30) {
    interval = 2; // Every 2 days
    periodFormat = 'day';
  }
  
  // Calculate current period trends
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + interval)) {
    const periodStart = new Date(d);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + interval);
    
    const periodBookings = bookings.filter((b: Booking) => {
      if (!b.startTime || b.status !== 'Confirmed' || b.paymentStatus !== 'Paid') return false;
      const bookingDate = b.startTime.toDate ? b.startTime.toDate() : new Date(b.startTime);
      return bookingDate >= periodStart && bookingDate < periodEnd;
    });
    
    const revenue = periodBookings.reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
    const bookingsCount = periodBookings.length;
    const averageBookingValue = bookingsCount > 0 ? revenue / bookingsCount : 0;
    
    let periodLabel = '';
    if (periodFormat === 'week') {
      periodLabel = `Week ${periodStart.getDate()}/${periodStart.getMonth() + 1}`;
    } else {
      periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    trends.push({
      period: periodLabel,
      revenue,
      bookings: bookingsCount,
      averageBookingValue
    });
  }
  
  // Calculate growth if previous period data is provided
  if (previousPeriod && previousBookings) {
    const previousRevenue = previousBookings
      .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
      .reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
    
    const currentRevenue = bookings
      .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
      .reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
    
    if (previousRevenue > 0) {
      const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      trends.forEach(trend => {
        trend.growth = growth;
      });
    }
  }
  
  return trends;
};

/**
 * Calculate user growth metrics
 */
export const calculateUserGrowth = (
  users: User[],
  dateRange: { start: Date; end: Date },
  previousPeriod?: { start: Date; end: Date },
  previousUsers?: User[]
): UserGrowth[] => {
  const growth: UserGrowth[] = [];
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  
  // Determine interval
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let interval = 1; // Daily
  if (diffDays > 90) {
    interval = 7; // Weekly
  } else if (diffDays > 30) {
    interval = 2; // Every 2 days
  }
  
  // Calculate current period growth
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + interval)) {
    const periodStart = new Date(d);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + interval);
    
    const newUsersInPeriod = users.filter((u: User) => {
      if (!u.createdAt) return false;
      const userDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
      return userDate >= periodStart && userDate < periodEnd;
    });
    
    const totalUsersUpToPeriod = users.filter((u: User) => {
      if (!u.createdAt) return false;
      const userDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
      return userDate < periodEnd;
    });
    
    // Active users (users who have bookings in the period)
    // This would require booking data, so we'll use a simplified version
    const activeUsers = totalUsersUpToPeriod.length; // Simplified
    
    let periodLabel = '';
    if (interval === 7) {
      periodLabel = `Week ${periodStart.getDate()}/${periodStart.getMonth() + 1}`;
    } else {
      periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    growth.push({
      period: periodLabel,
      newUsers: newUsersInPeriod.length,
      totalUsers: totalUsersUpToPeriod.length,
      activeUsers
    });
  }
  
  // Calculate growth percentage if previous period data is provided
  if (previousPeriod && previousUsers) {
    const previousTotal = previousUsers.length;
    const currentTotal = users.length;
    
    if (previousTotal > 0) {
      const growthPercentage = ((currentTotal - previousTotal) / previousTotal) * 100;
      growth.forEach(g => {
        g.growth = growthPercentage;
      });
    }
  }
  
  return growth;
};

/**
 * Calculate venue performance metrics
 */
export const calculateVenuePerformance = (
  bookings: Booking[],
  venues: Venue[],
  dateRange: { start: Date; end: Date },
  previousPeriod?: { start: Date; end: Date },
  previousBookings?: Booking[]
): VenuePerformance[] => {
  const performance: VenuePerformance[] = [];
  
  venues.forEach(venue => {
    const venueBookings = bookings.filter((b: Booking) => 
      b.venueId === venue.id && 
      b.status === 'Confirmed' && 
      b.paymentStatus === 'Paid'
    );
    
    const revenue = venueBookings.reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
    const bookingsCount = venueBookings.length;
    const averageBookingValue = bookingsCount > 0 ? revenue / bookingsCount : 0;
    
    // Calculate occupancy rate (simplified - would need court availability data)
    // For now, we'll use bookings per day as a proxy
    const daysInRange = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const totalCourts = venue.courts?.length || 1;
    const totalPossibleSlots = daysInRange * totalCourts * 12; // Assuming 12 slots per day per court
    const occupancyRate = totalPossibleSlots > 0 ? (bookingsCount / totalPossibleSlots) * 100 : 0;
    
    // Calculate growth if previous period data is provided
    let growth: number | undefined;
    if (previousPeriod && previousBookings) {
      const previousVenueBookings = previousBookings.filter((b: Booking) => 
        b.venueId === venue.id && 
        b.status === 'Confirmed' && 
        b.paymentStatus === 'Paid'
      );
      const previousRevenue = previousVenueBookings.reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
      
      if (previousRevenue > 0) {
        growth = ((revenue - previousRevenue) / previousRevenue) * 100;
      }
    }
    
    performance.push({
      venueId: venue.id,
      venueName: venue.name,
      revenue,
      bookings: bookingsCount,
      averageBookingValue,
      occupancyRate: Math.min(occupancyRate, 100), // Cap at 100%
      growth
    });
  });
  
  // Sort by revenue (descending)
  return performance.sort((a, b) => b.revenue - a.revenue);
};

/**
 * Calculate booking patterns by hour
 */
export const calculateBookingPatternsByHour = (
  bookings: Booking[]
): BookingPattern[] => {
  const patterns: Record<number, { bookings: number; revenue: number }> = {};
  
  bookings
    .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
    .forEach((booking: Booking) => {
      if (!booking.startTime) return;
      const date = booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
      const hour = date.getHours();
      
      if (!patterns[hour]) {
        patterns[hour] = { bookings: 0, revenue: 0 };
      }
      
      patterns[hour].bookings += 1;
      patterns[hour].revenue += booking.amount || 0;
    });
  
  // Convert to array and format
  return Array.from({ length: 24 }, (_, hour) => {
    const pattern = patterns[hour] || { bookings: 0, revenue: 0 };
    const averageValue = pattern.bookings > 0 ? pattern.revenue / pattern.bookings : 0;
    
    let hourLabel = '';
    if (hour === 0) {
      hourLabel = '12AM';
    } else if (hour < 12) {
      hourLabel = `${hour}AM`;
    } else if (hour === 12) {
      hourLabel = '12PM';
    } else {
      hourLabel = `${hour - 12}PM`;
    }
    
    return {
      hour,
      hourLabel,
      bookings: pattern.bookings,
      revenue: pattern.revenue,
      averageValue
    };
  });
};

/**
 * Calculate booking patterns by day of week
 */
export const calculateBookingPatternsByDay = (
  bookings: Booking[]
): DayOfWeekPattern[] => {
  const patterns: Record<number, { bookings: number; revenue: number }> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  bookings
    .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
    .forEach((booking: Booking) => {
      if (!booking.startTime) return;
      const date = booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
      const dayIndex = date.getDay();
      
      if (!patterns[dayIndex]) {
        patterns[dayIndex] = { bookings: 0, revenue: 0 };
      }
      
      patterns[dayIndex].bookings += 1;
      patterns[dayIndex].revenue += booking.amount || 0;
    });
  
  // Convert to array
  return dayNames.map((day, dayIndex) => {
    const pattern = patterns[dayIndex] || { bookings: 0, revenue: 0 };
    const averageValue = pattern.bookings > 0 ? pattern.revenue / pattern.bookings : 0;
    
    return {
      day,
      dayIndex,
      bookings: pattern.bookings,
      revenue: pattern.revenue,
      averageValue
    };
  });
};

/**
 * Calculate booking patterns by sport type
 */
export const calculateBookingPatternsBySport = (
  bookings: Booking[]
): SportTypePattern[] => {
  const patterns: Record<string, { bookings: number; revenue: number }> = {};
  const totalBookings = bookings.filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid').length;
  
  bookings
    .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
    .forEach((booking: Booking) => {
      const sport = booking.sport || 'Unknown';
      
      if (!patterns[sport]) {
        patterns[sport] = { bookings: 0, revenue: 0 };
      }
      
      patterns[sport].bookings += 1;
      patterns[sport].revenue += booking.amount || 0;
    });
  
  // Convert to array
  return Object.entries(patterns).map(([sport, pattern]) => {
    const averageValue = pattern.bookings > 0 ? pattern.revenue / pattern.bookings : 0;
    const percentage = totalBookings > 0 ? (pattern.bookings / totalBookings) * 100 : 0;
    
    return {
      sport,
      bookings: pattern.bookings,
      revenue: pattern.revenue,
      averageValue,
      percentage
    };
  }).sort((a, b) => b.revenue - a.revenue);
};

/**
 * Calculate period comparison metrics
 */
export const calculatePeriodComparison = (
  currentBookings: Booking[],
  previousBookings: Booking[]
): {
  revenueGrowth: number;
  bookingsGrowth: number;
  averageValueGrowth: number;
  currentRevenue: number;
  previousRevenue: number;
  currentBookings: number;
  previousBookings: number;
} => {
  const currentRevenue = currentBookings
    .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
    .reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
  
  const previousRevenue = previousBookings
    .filter((b: Booking) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
    .reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);
  
  const currentBookingsCount = currentBookings.filter((b: Booking) => 
    b.status === 'Confirmed' && b.paymentStatus === 'Paid'
  ).length;
  
  const previousBookingsCount = previousBookings.filter((b: Booking) => 
    b.status === 'Confirmed' && b.paymentStatus === 'Paid'
  ).length;
  
  const currentAverageValue = currentBookingsCount > 0 ? currentRevenue / currentBookingsCount : 0;
  const previousAverageValue = previousBookingsCount > 0 ? previousRevenue / previousBookingsCount : 0;
  
  const revenueGrowth = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : 0;
  
  const bookingsGrowth = previousBookingsCount > 0 
    ? ((currentBookingsCount - previousBookingsCount) / previousBookingsCount) * 100 
    : 0;
  
  const averageValueGrowth = previousAverageValue > 0 
    ? ((currentAverageValue - previousAverageValue) / previousAverageValue) * 100 
    : 0;
  
  return {
    revenueGrowth,
    bookingsGrowth,
    averageValueGrowth,
    currentRevenue,
    previousRevenue,
    currentBookings: currentBookingsCount,
    previousBookings: previousBookingsCount
  };
};

/**
 * Get previous period date range
 */
export const getPreviousPeriod = (
  dateRange: { start: Date; end: Date }
): { start: Date; end: Date } => {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const diffTime = end.getTime() - start.getTime();
  
  return {
    start: new Date(start.getTime() - diffTime),
    end: new Date(start.getTime() - 1)
  };
};

