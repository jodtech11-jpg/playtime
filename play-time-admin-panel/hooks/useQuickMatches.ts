import { useState, useEffect } from 'react';
import { QuickMatch } from '../types';
import { quickMatchesCollection } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { vendorIdFilter } from '../utils/vendorScope';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseQuickMatchesOptions {
  venueId?: string;
  status?: QuickMatch['status'];
  sport?: string;
  realtime?: boolean;
}

const sortByDateAsc = (rows: QuickMatch[]) =>
  [...rows].sort((a, b) => {
    const aTime =
      a.date?.toMillis?.() ??
      a.date?.seconds ??
      a.createdAt?.toMillis?.() ??
      a.createdAt?.seconds ??
      0;
    const bTime =
      b.date?.toMillis?.() ??
      b.date?.seconds ??
      b.createdAt?.toMillis?.() ??
      b.createdAt?.seconds ??
      0;
    return aTime - bTime;
  });

const uniqueById = (rows: QuickMatch[]) => {
  const map = new Map<string, QuickMatch>();
  rows.forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  return [...map.values()];
};

export const useQuickMatches = (options: UseQuickMatchesOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [matches, setMatches] = useState<QuickMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const managedVenuesKey = (user?.managedVenues ?? []).filter(Boolean).join(',');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isVenueManager && !user.id) {
      setMatches([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    const unsubscribers: Array<() => void> = [];

    const sharedFilters: { field: string; operator: string; value: unknown }[] = [];
    if (options.status) {
      sharedFilters.push({
        field: 'status',
        operator: '==',
        value: options.status,
      });
    }
    if (options.sport) {
      sharedFilters.push({
        field: 'sport',
        operator: '==',
        value: options.sport,
      });
    }

    const buildFilterSets = () => {
      const sets: { field: string; operator: string; value: unknown }[][] = [];
      const managed = (user.managedVenues ?? []).filter(Boolean);

      if (isVenueManager) {
        if (options.venueId) {
          sets.push([
            { field: 'venueId', operator: '==', value: options.venueId },
            ...sharedFilters,
          ]);
        } else if (managed.length > 0) {
          // Prefer venue scope so legacy docs without vendorId still appear.
          const chunkSize = 10;
          for (let i = 0; i < managed.length; i += chunkSize) {
            const chunk = managed.slice(i, i + chunkSize);
            sets.push([
              {
                field: 'venueId',
                operator: chunk.length === 1 ? '==' : 'in',
                value: chunk.length === 1 ? chunk[0] : chunk,
              },
              ...sharedFilters,
            ]);
          }
        } else if (user.id) {
          sets.push([vendorIdFilter(user.id), ...sharedFilters]);
        }
      } else if (options.venueId) {
        sets.push([
          { field: 'venueId', operator: '==', value: options.venueId },
          ...sharedFilters,
        ]);
      } else {
        sets.push([...sharedFilters]);
      }

      return sets.length ? sets : [sharedFilters];
    };

    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);
        const filterSets = buildFilterSets();

        if (options.realtime) {
          const bucket = new Map<number, QuickMatch[]>();
          filterSets.forEach((filters, index) => {
            const unsub = quickMatchesCollection.subscribeAll(
              (data: QuickMatch[]) => {
                if (!mounted) return;
                bucket.set(index, data || []);
                const merged = uniqueById(
                  [...bucket.values()].flatMap((rows) => rows)
                );
                setMatches(sortByDateAsc(merged));
                setLoading(false);
              },
              filters.length > 0 ? filters : undefined
            );
            unsubscribers.push(unsub);
          });
        } else {
          const batches = await Promise.all(
            filterSets.map((filters) =>
              quickMatchesCollection.getAll(
                filters.length > 0 ? filters : undefined
              )
            )
          );
          if (!mounted) return;
          setMatches(sortByDateAsc(uniqueById(batches.flat() as QuickMatch[])));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching quick matches:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch quick matches'));
        setLoading(false);
      }
    };

    fetchMatches();

    return () => {
      mounted = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    user?.id,
    options.venueId,
    options.status,
    options.sport,
    options.realtime,
    isVenueManager,
    managedVenuesKey,
  ]);

  return { matches, loading, error };
};
