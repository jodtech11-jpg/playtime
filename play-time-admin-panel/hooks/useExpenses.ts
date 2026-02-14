import { useState, useEffect } from 'react';
import { expensesCollection } from '../services/firebase';
import { Expense } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

    const fetchExpenses = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        // Filter by venue if venue manager
        if (isVenueManager && user.managedVenues && user.managedVenues.length > 0) {
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: user.managedVenues
          });
        } else if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
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

        if (options.realtime) {
          const unsubscribe = expensesCollection.subscribeAll(
            (data: Expense[]) => {
              setExpenses(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'date',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await expensesCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'date',
            'desc',
            options.limit
          );
          setExpenses(data as Expense[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching expenses:', err);
        setError(err.message || 'Failed to fetch expenses');
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [user, options.venueId, options.staffId, options.category, options.limit, options.realtime, isVenueManager]);

  return { expenses, loading, error };
};

