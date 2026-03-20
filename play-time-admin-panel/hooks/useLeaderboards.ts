import { useState, useEffect } from 'react';
import { Leaderboard } from '../types';
import { leaderboardsCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

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

    const fetchLeaderboards = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setLeaderboards([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setLeaderboards([]);
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
            const ids = managed.slice(0, 10);
            if (managed.length > 10) {
              console.warn(
                'useLeaderboards: venue manager has more than 10 managedVenues; only the first 10 are queried.'
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

        if (options.realtime) {
          const unsubscribe = leaderboardsCollection.subscribeAll(
            (data: Leaderboard[]) => {
              setLeaderboards(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'updatedAt',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await leaderboardsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'updatedAt',
            'desc'
          );
          setLeaderboards(data as Leaderboard[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching leaderboards:', err);
        setError(err.message || 'Failed to fetch leaderboards');
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, [user, options.venueId, options.sport, options.type, options.realtime, isVenueManager]);

  return { leaderboards, loading, error };
};

