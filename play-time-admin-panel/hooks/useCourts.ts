import { useState, useEffect } from 'react';
import { courtsCollection, subscribeToCollection } from '../services/firebase';
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
          // Real-time subscription
          const unsubscribe = courtsCollection.subscribeAll(
            (data: Court[]) => {
              setCourts(data);
              setLoading(false);
            },
            filters,
            'createdAt',
            'asc'
          );

          return () => unsubscribe();
        } else {
          const data = await courtsCollection.getAll(filters);
          setCourts(data as Court[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching courts:', err);
        setError(err.message || 'Failed to fetch courts');
        setLoading(false);
      }
    };

    fetchCourts();
  }, [options.venueId, options.realtime]);

  return { courts, loading, error };
};

