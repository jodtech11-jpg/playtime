import { useState, useEffect } from 'react';
import { paymentsCollection } from '../services/firebase';
import { Payment } from '../types';
import { serverTimestamp } from 'firebase/firestore';

interface UsePaymentsOptions {
  type?: Payment['type'];
  direction?: Payment['direction'];
  venueId?: string;
  userId?: string;
  status?: Payment['status'];
  limit?: number;
  realtime?: boolean;
}

export const usePayments = (options: UsePaymentsOptions = {}) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchPayments = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (options.type) {
          filters.push({
            field: 'type',
            operator: '==',
            value: options.type
          });
        }

        if (options.direction) {
          filters.push({
            field: 'direction',
            operator: '==',
            value: options.direction
          });
        }

        if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
          });
        }

        if (options.userId) {
          filters.push({
            field: 'userId',
            operator: '==',
            value: options.userId
          });
        }

        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        if (options.realtime) {
          unsubscribe = paymentsCollection.subscribeAll(
            (data: Payment[]) => {
              if (mounted) {
                setPayments(data || []);
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            (subscribeError: any) => {
              console.error('Error in payment subscription:', subscribeError);
              if (mounted) {
                setError(subscribeError.message || 'Failed to subscribe to payments');
                setPayments([]);
                setLoading(false);
              }
            }
          );
        } else {
          const data = await paymentsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          );
          if (mounted) {
            setPayments(data as Payment[]);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching payments:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch payments');
          setLoading(false);
        }
      }
    };

    fetchPayments();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.type, options.direction, options.venueId, options.userId, options.status, options.limit, options.realtime]);

  const createPayment = async (paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);
    try {
      await paymentsCollection.create({
        ...paymentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error creating payment:', err);
      setError(err.message || 'Failed to create payment');
      setLoading(false);
      throw err;
    }
  };

  const updatePayment = async (paymentId: string, paymentData: Partial<Payment>) => {
    setLoading(true);
    setError(null);
    try {
      await paymentsCollection.update(paymentId, {
        ...paymentData,
        updatedAt: serverTimestamp()
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error updating payment:', err);
      setError(err.message || 'Failed to update payment');
      setLoading(false);
      throw err;
    }
  };

  return { payments, loading, error, createPayment, updatePayment };
};

