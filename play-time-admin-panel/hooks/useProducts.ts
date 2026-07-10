import { useState, useEffect } from 'react';
import { productsCollection } from '../services/firebase';
import { Product } from '../types';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseProductsOptions {
  category?: Product['category'];
  status?: Product['status'];
  venueId?: string;
  limit?: number;
  realtime?: boolean;
}

export const useProducts = (options: UseProductsOptions = {}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // limit: 0 means "skip fetching" (e.g. global search while idle)
    if (options.limit === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (options.category) {
          filters.push({
            field: 'category',
            operator: '==',
            value: options.category
          });
        }

        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
          });
        }

        if (options.realtime) {
          unsubscribe = productsCollection.subscribeAll(
            (data: Product[]) => {
              if (!mounted) return;
              setProducts(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await productsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          ) as Product[];
          if (!mounted) return;
          setProducts(data);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching products:', err);
        if (!mounted) return;
        setError(getFirebaseErrorMessage(err, 'Failed to fetch products'));
        setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.category, options.status, options.venueId, options.limit, options.realtime]);

  return { products, loading, error };
};

