import { useState, useEffect } from 'react';
import { Poll } from '../types';
import { pollsCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

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

    const fetchPolls = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setPolls([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setPolls([]);
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
                'usePolls: venue manager has more than 10 managedVenues; only the first 10 are queried.'
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
          const unsubscribe = pollsCollection.subscribeAll(
            (data: Poll[]) => {
              setPolls(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await pollsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          setPolls(data as Poll[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching polls:', err);
        setError(err.message || 'Failed to fetch polls');
        setLoading(false);
      }
    };

    fetchPolls();
  }, [user, options.venueId, options.sport, options.status, options.realtime, isVenueManager]);

  return { polls, loading, error };
};

