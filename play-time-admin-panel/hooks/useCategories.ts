import { useState, useEffect } from 'react';
import { categoriesCollection } from '../services/firebase';
import { Category } from '../types';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseCategoriesOptions {
  activeOnly?: boolean;
  realtime?: boolean;
}

export const useCategories = (options: UseCategoriesOptions = {}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchCategories = async () => {
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

        const sortCategories = (data: Category[]) =>
          [...data].sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) {
              return a.order - b.order;
            }
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return a.name.localeCompare(b.name);
          });

        if (options.realtime) {
          // Sort in memory — never orderBy('order') in Firestore. Documents
          // missing `order` are excluded from orderBy queries, so newly created
          // categories would never appear in Manage Categories.
          unsubscribe = categoriesCollection.subscribeAll(
            (data: Category[]) => {
              setCategories(sortCategories(data));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await categoriesCollection.getAll(
            filters.length > 0 ? filters : undefined
          ) as Category[];
          setCategories(sortCategories(data));
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch categories'));
        setLoading(false);
      }
    };

    fetchCategories();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.activeOnly, options.realtime]);

  return { categories, loading, error };
};

