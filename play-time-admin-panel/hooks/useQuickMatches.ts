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

        // Filter by venue if venue manager
        if (isVenueManager && user.managedVenues && user.managedVenues.length > 0) {
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: user.managedVenues
          });
        } else if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
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

