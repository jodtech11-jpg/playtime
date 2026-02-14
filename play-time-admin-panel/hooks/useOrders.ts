import { useState, useEffect } from 'react';
import { ordersCollection } from '../services/firebase';
import { Order } from '../types';

interface UseOrdersOptions {
  status?: Order['status'];
  paymentStatus?: Order['paymentStatus'];
  userId?: string;
  limit?: number;
  realtime?: boolean;
}

export const useOrders = (options: UseOrdersOptions = {}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

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
              setOrders(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await ordersCollection.getAll(
            filters.length > 0 ? filters : undefined
          ) as Order[];
          setOrders(data);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        setError(err.message || 'Failed to fetch orders');
        setLoading(false);
      }
    };

    fetchOrders();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.status, options.paymentStatus, options.userId, options.limit, options.realtime]);

  return { orders, loading, error };
};

