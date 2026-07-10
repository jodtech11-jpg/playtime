import { useState, useEffect } from 'react';
import { expensesCollection } from '../services/firebase';
import { Expense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseExpensesOptions {
  venueId?: string;
  staffId?: string;
  category?: Expense['category'];
  limit?: number;
  realtime?: boolean;
}

export const useExpenses = (options: UseExpensesOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchExpenses = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setExpenses([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setExpenses([]);
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
            const ids = managed.slice(0, 30);
            if (managed.length > 30) {
              console.warn(
                'useExpenses: venue manager has more than 30 managedVenues; only the first 30 are queried.'
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

        // Filter by staff
        if (options.staffId) {
          filters.push({
            field: 'staffId',
            operator: '==',
            value: options.staffId
          });
        }

        // Filter by category
        if (options.category) {
          filters.push({
            field: 'category',
            operator: '==',
            value: options.category
          });
        }

        const sortByDateDesc = (rows: Expense[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.date?.toMillis?.() ?? a.date?.seconds ?? a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.date?.toMillis?.() ?? b.date?.seconds ?? b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
          });

        if (options.realtime) {
          unsubscribe = expensesCollection.subscribeAll(
            (data: Expense[]) => {
              if (!mounted) return;
              setExpenses(sortByDateDesc(data));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await expensesCollection.getAll(
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            options.limit
          );
          if (!mounted) return;
          setExpenses(sortByDateDesc(data as Expense[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching expenses:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch expenses'));
        setLoading(false);
      }
    };

    fetchExpenses();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, options.venueId, options.staffId, options.category, options.limit, options.realtime, isVenueManager]);

  return { expenses, loading, error };
};

