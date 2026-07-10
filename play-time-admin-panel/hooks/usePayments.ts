import { useState, useEffect } from 'react';
import { paymentsCollection } from '../services/firebase';
import { Payment } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UsePaymentsOptions {
  type?: Payment['type'];
  direction?: Payment['direction'];
  venueId?: string;
  /** When set, filters with venueId `in` (up to 30). Takes precedence over venueId. */
  venueIds?: string[];
  userId?: string;
  status?: Payment['status'];
  limit?: number;
  realtime?: boolean;
}

const sortByCreatedDesc = (rows: Payment[]) =>
  [...rows].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });

export const usePayments = (options: UsePaymentsOptions = {}) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
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

        if (!user) {
          if (mounted) {
            setPayments([]);
            setLoading(false);
          }
          return;
        }

        // Vendors with no managed venues: never run an unscoped query.
        if (isVenueManager && !isSuperAdmin) {
          const managed = options.venueIds?.length
            ? options.venueIds
            : options.venueId
              ? [options.venueId]
              : (user.managedVenues?.filter(Boolean) ?? []);
          if (managed.length === 0) {
            if (mounted) {
              setPayments([]);
              setLoading(false);
            }
            return;
          }
        }

        const filters: { field: string; operator: string; value: unknown }[] = [];

        if (options.type) {
          filters.push({ field: 'type', operator: '==', value: options.type });
        }
        if (options.direction) {
          filters.push({ field: 'direction', operator: '==', value: options.direction });
        }

        if (options.venueIds && options.venueIds.length > 0) {
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: options.venueIds.slice(0, 30),
          });
        } else if (options.venueId) {
          filters.push({ field: 'venueId', operator: '==', value: options.venueId });
        } else if (isVenueManager && !isSuperAdmin) {
          const managed = user.managedVenues?.filter(Boolean) ?? [];
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: managed.slice(0, 30),
          });
        }

        if (options.userId) {
          filters.push({ field: 'userId', operator: '==', value: options.userId });
        }
        if (options.status) {
          filters.push({ field: 'status', operator: '==', value: options.status });
        }

        // Sort in memory — avoid orderBy so venueId-in queries don't need a composite index.
        if (options.realtime) {
          unsubscribe = paymentsCollection.subscribeAll(
            (data: Payment[]) => {
              if (mounted) {
                setPayments(sortByCreatedDesc(data || []));
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            (subscribeError: any) => {
              console.error('Error in payment subscription:', subscribeError);
              if (mounted) {
                setError(getFirebaseErrorMessage(subscribeError, 'Failed to subscribe to payments'));
                setPayments([]);
                setLoading(false);
              }
            }
          );
        } else {
          const data = await paymentsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            options.limit
          );
          if (mounted) {
            setPayments(sortByCreatedDesc(data as Payment[]));
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching payments:', err);
        if (mounted) {
          setError(getFirebaseErrorMessage(err, 'Failed to fetch payments'));
          setLoading(false);
        }
      }
    };

    fetchPayments();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    user?.id,
    isVenueManager,
    isSuperAdmin,
    user?.managedVenues?.join(','),
    options.type,
    options.direction,
    options.venueId,
    options.venueIds?.join(','),
    options.userId,
    options.status,
    options.limit,
    options.realtime,
  ]);

  const createPayment = async (paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);
    try {
      await paymentsCollection.create({
        ...paymentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error creating payment:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to create payment'));
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
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error updating payment:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to update payment'));
      setLoading(false);
      throw err;
    }
  };

  return { payments, loading, error, createPayment, updatePayment };
};
