import { useState, useEffect } from 'react';
import { sportsCollection } from '../services/firebase';
import { Sport } from '../types';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseSportsOptions {
  activeOnly?: boolean;
  realtime?: boolean;
}

/** Prefer the sport with an explicit `order`, then keep first by name (case-insensitive). */
const dedupeSportsByName = (sports: Sport[]): Sport[] => {
  const byName = new Map<string, Sport>();
  for (const sport of sports) {
    const key = (sport.name || '').trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, sport);
      continue;
    }
    // Prefer the document that has an order value (canonical catalog entry)
    if (existing.order === undefined && sport.order !== undefined) {
      byName.set(key, sport);
    }
  }
  return Array.from(byName.values()).sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
};

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
          // Sort in memory — never orderBy in Firestore. Documents missing the
          // `order` field are excluded from orderBy queries, so newly created
          // sports without an order value would never appear in the list.
          unsubscribe = sportsCollection.subscribeAll(
            (data: Sport[]) => {
              const sorted = dedupeSportsByName(data);
              setSports(sorted);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await sportsCollection.getAll(
            filters.length > 0 ? filters : undefined
          ) as Sport[];
          setSports(dedupeSportsByName(data));
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching sports:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch sports'));
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

