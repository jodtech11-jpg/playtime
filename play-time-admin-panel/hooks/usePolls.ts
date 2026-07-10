import { useState, useEffect } from 'react';
import { Poll } from '../types';
import { pollsCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { vendorIdFilter } from '../utils/vendorScope';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UsePollsOptions {
  venueId?: string;
  sport?: string;
  status?: Poll['status'];
  realtime?: boolean;
}

export const usePolls = (options: UsePollsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isVenueManager && !user.id) {
      setPolls([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchPolls = async () => {
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

        const sortByCreatedDesc = (rows: Poll[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });

        // Sort in memory — avoid orderBy so vendor filters don't need composite indexes.
        if (options.realtime) {
          unsubscribe = pollsCollection.subscribeAll(
            (data: Poll[]) => {
              if (!mounted) return;
              setPolls(sortByCreatedDesc(data || []));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await pollsCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          setPolls(sortByCreatedDesc(data as Poll[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching polls:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch polls'));
        setLoading(false);
      }
    };

    fetchPolls();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, options.venueId, options.sport, options.status, options.realtime, isVenueManager]);

  return { polls, loading, error };
};

