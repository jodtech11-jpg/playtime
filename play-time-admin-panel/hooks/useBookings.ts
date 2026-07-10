import { useState, useEffect, useMemo, useRef } from 'react';
import { bookingsCollection } from '../services/firebase';
import { Booking } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseBookingsOptions {
  venueId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: Booking['status'];
  sport?: string;
  limit?: number;
  realtime?: boolean;
}

export const useBookings = (options: UseBookingsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Memoize dateRange to prevent infinite loops
  const dateRangeRef = useRef(options.dateRange);
  useEffect(() => {
    dateRangeRef.current = options.dateRange;
  }, [options.dateRange?.start?.getTime(), options.dateRange?.end?.getTime()]);

  // Memoize user managed venues to prevent unnecessary re-renders
  const managedVenues = useMemo(() => {
    return user?.managedVenues?.filter(Boolean) ?? [];
  }, [user?.managedVenues?.join(',')]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // limit: 0 means "skip fetching" (used by consumers like global search
    // when idle) — don't load the entire collection.
    if (options.limit === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchBookings = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (isVenueManager) {
          if (managedVenues.length === 0) {
            setBookings([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managedVenues.includes(options.venueId)) {
            setBookings([]);
            setLoading(false);
            return;
          }
          if (options.venueId) {
            filters.push({
              field: 'venueId',
              operator: '==',
              value: options.venueId,
            });
          } else {
            // Firestore `in` supports up to 30 values
            const ids = managedVenues.slice(0, 30);
            if (managedVenues.length > 30) {
              console.warn(
                'useBookings: venue manager has more than 30 managedVenues; only the first 30 are queried (Firestore in limit).'
              );
            }
            filters.push({
              field: 'venueId',
              operator: 'in',
              value: ids,
            });
          }
        } else if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId,
          });
        }

        // Filter by status
        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        // Filter by sport
        if (options.sport) {
          filters.push({
            field: 'sport',
            operator: '==',
            value: options.sport
          });
        }

        // Filter by date range
        const dateRange = dateRangeRef.current;
        if (dateRange) {
          filters.push({
            field: 'startTime',
            operator: '>=',
            value: dateRange.start
          });
          filters.push({
            field: 'startTime',
            operator: '<=',
            value: dateRange.end
          });
        }

        if (options.realtime) {
          // Real-time subscription
          unsubscribe = bookingsCollection.subscribeAll(
            (data: Booking[]) => {
              if (!mounted) return;
              setBookings(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'startTime',
            'asc'
          );
        } else {
          // One-time fetch
          const data = await bookingsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'startTime',
            'desc',
            options.limit
          ) as Booking[];
          if (!mounted) return;
          setBookings(data as Booking[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching bookings:', err);
        if (!mounted) return;
        setError(getFirebaseErrorMessage(err, 'Failed to fetch bookings'));
        setLoading(false);
      }
    };

    fetchBookings();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id, options.venueId, options.status, options.sport, options.limit, options.realtime, isVenueManager, managedVenues.join(','), options.dateRange?.start?.getTime(), options.dateRange?.end?.getTime()]);

  return { bookings, loading, error };
};

// Hook for today's bookings
export const useTodaysBookings = () => {
  // Recompute when the calendar date changes (e.g. app left open past midnight)
  const todayStr = new Date().toDateString();
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: today, end: tomorrow };
  }, [todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  return useBookings({
    dateRange,
    realtime: true
  });
};

// Hook for pending bookings
export const usePendingBookings = () => {
  return useBookings({
    status: 'Pending',
    realtime: true
  });
};

