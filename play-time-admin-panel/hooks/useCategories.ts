import { useState, useEffect } from 'react';
import { categoriesCollection } from '../services/firebase';
import { Category } from '../types';

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

        if (options.realtime) {
          unsubscribe = categoriesCollection.subscribeAll(
            (data: Category[]) => {
              // Sort by order if available, then by name
              const sorted = [...data].sort((a, b) => {
                if (a.order !== undefined && b.order !== undefined) {
                  return a.order - b.order;
                }
                if (a.order !== undefined) return -1;
                if (b.order !== undefined) return 1;
                return a.name.localeCompare(b.name);
              });
              setCategories(sorted);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'order',
            'asc'
          );
        } else {
          const data = await categoriesCollection.getAll(
            filters.length > 0 ? filters : undefined
          ) as Category[];
          // Sort by order if available, then by name
          const sorted = [...data].sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) {
              return a.order - b.order;
            }
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return a.name.localeCompare(b.name);
          });
          setCategories(sorted);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        setError(err.message || 'Failed to fetch categories');
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

