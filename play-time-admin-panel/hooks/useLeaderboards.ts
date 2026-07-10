import { useState, useEffect } from 'react';
import { Leaderboard } from '../types';
import { leaderboardsCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { vendorIdFilter } from '../utils/vendorScope';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseLeaderboardsOptions {
  venueId?: string;
  sport?: string;
  type?: Leaderboard['type'];
  realtime?: boolean;
}

export const useLeaderboards = (options: UseLeaderboardsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isVenueManager && !user.id) {
      setLeaderboards([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchLeaderboards = async () => {
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

        // Filter by type
        if (options.type) {
          filters.push({
            field: 'type',
            operator: '==',
            value: options.type
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

        const sortByUpdatedDesc = (rows: Leaderboard[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds ?? a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds ?? b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });

        // Sort in memory — avoid orderBy so vendor filters don't need composite indexes.
        if (options.realtime) {
          unsubscribe = leaderboardsCollection.subscribeAll(
            (data: Leaderboard[]) => {
              if (!mounted) return;
              setLeaderboards(sortByUpdatedDesc(data || []));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await leaderboardsCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          setLeaderboards(sortByUpdatedDesc(data as Leaderboard[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching leaderboards:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch leaderboards'));
        setLoading(false);
      }
    };

    fetchLeaderboards();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, options.venueId, options.sport, options.type, options.realtime, isVenueManager]);

  return { leaderboards, loading, error };
};

