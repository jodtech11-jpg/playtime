import { useState, useEffect } from 'react';
import { QuickMatch } from '../types';
import { quickMatchesCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { vendorIdFilter } from '../utils/vendorScope';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseQuickMatchesOptions {
  venueId?: string;
  status?: QuickMatch['status'];
  sport?: string;
  realtime?: boolean;
}

export const useQuickMatches = (options: UseQuickMatchesOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [matches, setMatches] = useState<QuickMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isVenueManager && !user.id) {
      setMatches([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: { field: string; operator: string; value: unknown }[] = [];

        if (isVenueManager && user.id) {
          filters.push(vendorIdFilter(user.id));
          if (options.venueId) {
            filters.push({
              field: 'venueId',
              operator: '==',
              value: options.venueId,
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

        const sortByDateAsc = (rows: QuickMatch[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.date?.toMillis?.() ?? a.date?.seconds ?? a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.date?.toMillis?.() ?? b.date?.seconds ?? b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return aTime - bTime;
          });

        // Sort in memory — avoid orderBy so vendor filters don't need composite indexes.
        if (options.realtime) {
          unsubscribe = quickMatchesCollection.subscribeAll(
            (data: QuickMatch[]) => {
              if (!mounted) return;
              setMatches(sortByDateAsc(data || []));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await quickMatchesCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          setMatches(sortByDateAsc(data as QuickMatch[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching quick matches:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch quick matches'));
        setLoading(false);
      }
    };

    fetchMatches();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, options.venueId, options.status, options.sport, options.realtime, isVenueManager]);

  return { matches, loading, error };
};

