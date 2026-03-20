import { useState, useEffect } from 'react';
import { FlashDeal } from '../types';
import { flashDealsCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UseFlashDealsOptions {
  venueId?: string;
  status?: FlashDeal['status'];
  realtime?: boolean;
}

export const useFlashDeals = (options: UseFlashDealsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchDeals = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setDeals([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setDeals([]);
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
                'useFlashDeals: venue manager has more than 10 managedVenues; only the first 10 are queried.'
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

        if (options.realtime) {
          const unsubscribe = flashDealsCollection.subscribeAll(
            (data: FlashDeal[]) => {
              setDeals(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'startTime',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await flashDealsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'startTime',
            'desc'
          );
          setDeals(data as FlashDeal[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching flash deals:', err);
        setError(err.message || 'Failed to fetch flash deals');
        setLoading(false);
      }
    };

    fetchDeals();
  }, [user, options.venueId, options.status, options.realtime, isVenueManager]);

  return { deals, loading, error };
};

