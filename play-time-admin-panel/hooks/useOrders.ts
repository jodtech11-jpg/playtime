import { useState, useEffect } from 'react';
import { ordersCollection } from '../services/firebase';
import { Order } from '../types';
import { getFirebaseErrorMessage } from '../utils/errorUtils';
import { useAuth } from '../contexts/AuthContext';

interface UseOrdersOptions {
  status?: Order['status'];
  paymentStatus?: Order['paymentStatus'];
  userId?: string;
  limit?: number;
  realtime?: boolean;
}

export const useOrders = (options: UseOrdersOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // limit: 0 means "skip fetching" (e.g. global search while idle)
    if (options.limit === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];
        const managedVenues = user?.managedVenues?.filter(Boolean) ?? [];

        if (isVenueManager) {
          if (managedVenues.length === 0) {
            setOrders([]);
            setError('No managed venue is assigned to this vendor account.');
            setLoading(false);
            return;
          }
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: managedVenues.slice(0, 30)
          });
        }

        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        if (options.paymentStatus) {
          filters.push({
            field: 'paymentStatus',
            operator: '==',
            value: options.paymentStatus
          });
        }

        if (options.userId) {
          filters.push({
            field: 'userId',
            operator: '==',
            value: options.userId
          });
        }

        if (options.realtime) {
          unsubscribe = ordersCollection.subscribeAll(
            (data: Order[]) => {
              if (!mounted) return;
              setOrders(
                [...data].sort((a, b) => {
                  const toMillis = (value: any) =>
                    value?.toMillis?.() ??
                    value?.toDate?.()?.getTime?.() ??
                    new Date(value ?? 0).getTime();
                  return toMillis(b.createdAt) - toMillis(a.createdAt);
                })
              );
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            (subscriptionError: any) => {
              if (!mounted) return;
              setError(getFirebaseErrorMessage(subscriptionError, 'Failed to fetch orders'));
              setLoading(false);
            }
          );
        } else {
          const data = await ordersCollection.getAll(
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            options.limit
          ) as Order[];
          if (!mounted) return;
          setOrders(
            [...data].sort((a, b) => {
              const toMillis = (value: any) =>
                value?.toMillis?.() ??
                value?.toDate?.()?.getTime?.() ??
                new Date(value ?? 0).getTime();
              return toMillis(b.createdAt) - toMillis(a.createdAt);
            })
          );
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        if (!mounted) return;
        setError(getFirebaseErrorMessage(err, 'Failed to fetch orders'));
        setLoading(false);
      }
    };

    fetchOrders();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    user?.id,
    user?.managedVenues?.join(','),
    isVenueManager,
    options.status,
    options.paymentStatus,
    options.userId,
    options.limit,
    options.realtime
  ]);

  return { orders, loading, error };
};

