import { useState, useEffect } from 'react';
import { courtsCollection } from '../services/firebase';
import { Court } from '../types';

interface UseCourtsOptions {
  venueId?: string;
  realtime?: boolean;
}

export const useCourts = (options: UseCourtsOptions = {}) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.venueId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchCourts = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters = [
          {
            field: 'venueId',
            operator: '==',
            value: options.venueId
          }
        ];

        if (options.realtime) {
          // Real-time subscription (no orderBy to avoid composite index requirement; sort in memory)
          unsubscribe = courtsCollection.subscribeAll(
            (data: Court[]) => {
              if (!mounted) return;
              const sorted = [...data].sort((a, b) => {
                const aTime = a.createdAt && (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : a.createdAt);
                const bTime = b.createdAt && (typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate() : b.createdAt);
                if (!aTime) return 1;
                if (!bTime) return -1;
                return new Date(aTime).getTime() - new Date(bTime).getTime();
              });
              setCourts(sorted);
              setLoading(false);
            },
            filters
            // omit orderByField/orderDirection so Firestore only filters by venueId (no composite index needed)
          );
        } else {
          const data = await courtsCollection.getAll(filters);
          if (!mounted) return;
          setCourts(data as Court[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching courts:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch courts');
          setLoading(false);
        }
      }
    };

    fetchCourts();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [options.venueId, options.realtime]);

  return { courts, loading, error };
};

