import { useState, useEffect } from 'react';
import { sportsCollection } from '../services/firebase';
import { Sport } from '../types';

interface UseSportsOptions {
  activeOnly?: boolean;
  realtime?: boolean;
}

export const useSports = (options: UseSportsOptions = {}) => {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchSports = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (options.activeOnly) {
          filters.push({
            field: 'isActive',
            operator: '==',
            value: true
          });
        }

        if (options.realtime) {
          // Don't use orderBy in query when we have filters to avoid index requirements
          // We'll sort in memory instead
          unsubscribe = sportsCollection.subscribeAll(
            (data: Sport[]) => {
              // Sort by order if available, then by name
              const sorted = [...data].sort((a, b) => {
                if (a.order !== undefined && b.order !== undefined) {
                  return a.order - b.order;
                }
                if (a.order !== undefined) return -1;
                if (b.order !== undefined) return 1;
                return a.name.localeCompare(b.name);
              });
              setSports(sorted);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            // Only use orderBy if no filters (to avoid composite index requirement)
            filters.length > 0 ? undefined : 'order',
            'asc'
          );
        } else {
          const data = await sportsCollection.getAll(
            filters.length > 0 ? filters : undefined
          ) as Sport[];
          // Sort by order if available, then by name
          const sorted = [...data].sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) {
              return a.order - b.order;
            }
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return a.name.localeCompare(b.name);
          });
          setSports(sorted);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching sports:', err);
        setError(err.message || 'Failed to fetch sports');
        setLoading(false);
      }
    };

    fetchSports();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.activeOnly, options.realtime]);

  return { sports, loading, error };
};

