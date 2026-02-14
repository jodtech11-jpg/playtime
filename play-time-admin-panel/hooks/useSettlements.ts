import { useState, useEffect, useMemo } from 'react';
import { settlementsCollection } from '../services/firebase';
import { Settlement } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useVenues } from './useVenues';

interface UseSettlementsOptions {
  venueId?: string;
  status?: Settlement['status'];
  limit?: number;
  realtime?: boolean;
}

export const useSettlements = (options: UseSettlementsOptions = {}) => {
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

        const filters: any[] = [];

        if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
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
          unsubscribe = settlementsCollection.subscribeAll(
            (data: Settlement[]) => {
              if (mounted) {
                setSettlements(data || []);
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            (subscribeError: any) => {
              console.error('Error in settlement subscription:', subscribeError);
              if (mounted) {
                setError(subscribeError.message || 'Failed to subscribe to settlements');
                setSettlements([]);
                setLoading(false);
              }
            }
          );
        } else {
          const data = await settlementsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          );
          if (mounted) {
            setSettlements(data as Settlement[]);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching settlements:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch settlements');
          setLoading(false);
        }
      }
    };

    fetchSettlements();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.venueId, options.status, options.limit, options.realtime]);

  const createSettlement = async (settlementData: Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);
    try {
      await settlementsCollection.create({
        ...settlementData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error creating settlement:', err);
      setError(err.message || 'Failed to create settlement');
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
        updatedAt: serverTimestamp()
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error updating settlement:', err);
      setError(err.message || 'Failed to update settlement');
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
      await settlementsCollection.update(settlementId, {
        status: 'Paid',
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference,
        paymentDate: paymentData.paymentDate,
        paidDate: paymentData.paymentDate,
        receiptUrl: paymentData.receiptUrl,
        confirmedBy: paymentData.confirmedBy,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setLoading(false);
    } catch (err: any) {
      console.error('Error confirming settlement:', err);
      setError(err.message || 'Failed to confirm settlement');
      setLoading(false);
      throw err;
    }
  };

  // Populate venue names in settlements
  const settlementsWithVenueNames = useMemo(() => {
    return settlements.map(settlement => {
      const venue = venues.find(v => v.id === settlement.venueId);
      return {
        ...settlement,
        venueName: venue?.name || settlement.venueName || 'Unknown Venue'
      };
    });
  }, [settlements, venues]);

  return { 
    settlements: settlementsWithVenueNames, 
    loading, 
    error, 
    createSettlement, 
    updateSettlement, 
    confirmSettlement 
  };
};

