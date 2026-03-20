import { useState, useEffect } from 'react';
import { QuickMatch } from '../types';
import { quickMatchesCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { serverTimestamp } from 'firebase/firestore';

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

    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setMatches([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setMatches([]);
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
                'useQuickMatches: venue manager has more than 10 managedVenues; only the first 10 are queried.'
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

        if (options.realtime) {
          const unsubscribe = quickMatchesCollection.subscribeAll(
            (data: QuickMatch[]) => {
              setMatches(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'date',
            'asc'
          );

          return () => unsubscribe();
        } else {
          const data = await quickMatchesCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'date',
            'asc'
          );
          setMatches(data as QuickMatch[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching quick matches:', err);
        setError(err.message || 'Failed to fetch quick matches');
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, options.venueId, options.status, options.sport, options.realtime, isVenueManager]);

  return { matches, loading, error };
};

