import { useState, useEffect } from 'react';
import { FlashDeal } from '../types';
import { flashDealsCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { vendorIdFilter } from '../utils/vendorScope';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

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

    if (isVenueManager && !user.id) {
      setDeals([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchDeals = async () => {
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

        const sortByStartDesc = (rows: FlashDeal[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.startTime?.toMillis?.() ?? a.startTime?.seconds ?? a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.startTime?.toMillis?.() ?? b.startTime?.seconds ?? b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });

        // Sort in memory — avoid orderBy so vendor filters don't need composite indexes.
        if (options.realtime) {
          unsubscribe = flashDealsCollection.subscribeAll(
            (data: FlashDeal[]) => {
              if (!mounted) return;
              setDeals(sortByStartDesc(data || []));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await flashDealsCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          setDeals(sortByStartDesc(data as FlashDeal[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching flash deals:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch flash deals'));
        setLoading(false);
      }
    };

    fetchDeals();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, options.venueId, options.status, options.realtime, isVenueManager]);

  return { deals, loading, error };
};

