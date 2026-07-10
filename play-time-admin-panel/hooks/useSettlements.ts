import { useState, useEffect, useMemo } from 'react';
import { settlementsCollection } from '../services/firebase';
import { Settlement } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useVenues } from './useVenues';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseSettlementsOptions {
  venueId?: string;
  /** When set, filters with venueId `in` (up to 30). Takes precedence over venueId. */
  venueIds?: string[];
  status?: Settlement['status'];
  limit?: number;
  realtime?: boolean;
}

const sortByCreatedDesc = (rows: Settlement[]) =>
  [...rows].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });

export const useSettlements = (options: UseSettlementsOptions = {}) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { venues } = useVenues({ realtime: false });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchSettlements = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          if (mounted) {
            setSettlements([]);
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
              setSettlements([]);
              setLoading(false);
            }
            return;
          }
        }

        const filters: { field: string; operator: string; value: unknown }[] = [];

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

        if (options.status) {
          filters.push({ field: 'status', operator: '==', value: options.status });
        }

        // Sort in memory — avoid orderBy so venueId-in queries don't need a composite index.
        if (options.realtime) {
          unsubscribe = settlementsCollection.subscribeAll(
            (data: Settlement[]) => {
              if (mounted) {
                setSettlements(sortByCreatedDesc(data || []));
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            (subscribeError: any) => {
              console.error('Error in settlement subscription:', subscribeError);
              if (mounted) {
                setError(getFirebaseErrorMessage(subscribeError, 'Failed to subscribe to settlements'));
                setSettlements([]);
                setLoading(false);
              }
            }
          );
        } else {
          const data = await settlementsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            options.limit
          );
          if (mounted) {
            setSettlements(sortByCreatedDesc(data as Settlement[]));
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching settlements:', err);
        if (mounted) {
          setError(getFirebaseErrorMessage(err, 'Failed to fetch settlements'));
          setLoading(false);
        }
      }
    };

    fetchSettlements();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    user?.id,
    isVenueManager,
    isSuperAdmin,
    user?.managedVenues?.join(','),
    options.venueId,
    options.venueIds?.join(','),
    options.status,
    options.limit,
    options.realtime,
  ]);

  const createSettlement = async (settlementData: Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);
    try {
      await settlementsCollection.create({
        ...settlementData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error creating settlement:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to create settlement'));
      setLoading(false);
      throw err;
    }
  };

  const updateSettlement = async (settlementId: string, settlementData: Partial<Settlement>) => {
    setLoading(true);
    setError(null);
    try {
      await settlementsCollection.update(settlementId, {
        ...settlementData,
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error updating settlement:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to update settlement'));
      setLoading(false);
      throw err;
    }
  };

  const confirmSettlement = async (settlementId: string, paymentData: {
    paymentMethod: Settlement['paymentMethod'];
    paymentReference?: string;
    paymentDate: Date;
    receiptUrl?: string;
    confirmedBy: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const existing = await settlementsCollection.get(settlementId) as Settlement | null;
      if (!existing) {
        throw new Error('Settlement not found');
      }
      if (existing.status !== 'Pending') {
        throw new Error('Settlement has already been marked as paid');
      }

      await settlementsCollection.update(settlementId, {
        status: 'Paid',
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference,
        paymentDate: paymentData.paymentDate,
        paidDate: paymentData.paymentDate,
        receiptUrl: paymentData.receiptUrl,
        confirmedBy: paymentData.confirmedBy,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error confirming settlement:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to confirm settlement'));
      setLoading(false);
      throw err;
    }
  };

  const settlementsWithVenueNames = useMemo(() => {
    return settlements.map((settlement) => {
      const venue = venues.find((v) => v.id === settlement.venueId);
      return {
        ...settlement,
        venueName: venue?.name || settlement.venueName || 'Unknown Venue',
      };
    });
  }, [settlements, venues]);

  return {
    settlements: settlementsWithVenueNames,
    loading,
    error,
    createSettlement,
    updateSettlement,
    confirmSettlement,
  };
};
