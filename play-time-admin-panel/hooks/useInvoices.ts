import { useState, useEffect } from 'react';
import { invoicesCollection } from '../services/firebase';
import { Invoice } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

export const useInvoices = (realtime: boolean = false) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          if (mounted) {
            setInvoices([]);
            setLoading(false);
          }
          return;
        }

        const filters: { field: string; operator: string; value: unknown }[] = [];
        if (isVenueManager && !isSuperAdmin) {
          const managed = user.managedVenues?.filter(Boolean) ?? [];
          if (managed.length === 0) {
            if (mounted) {
              setInvoices([]);
              setLoading(false);
            }
            return;
          }
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: managed.slice(0, 30),
          });
        }

        const sortByCreatedDesc = (rows: Invoice[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });

        if (realtime) {
          unsubscribe = invoicesCollection.subscribeAll(
            (data: Invoice[]) => {
              if (mounted) {
                setInvoices(sortByCreatedDesc(data || []));
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            (subscribeError: any) => {
              console.error('Error in subscription:', subscribeError);
              if (mounted) {
                setError(getFirebaseErrorMessage(subscribeError, 'Failed to subscribe to invoices'));
                setInvoices([]);
                setLoading(false);
              }
            }
          );
        } else {
          const data = await invoicesCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (mounted) {
            setInvoices(sortByCreatedDesc(data as Invoice[]));
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching invoices:', err);
        if (mounted) {
          setError(getFirebaseErrorMessage(err, 'Failed to fetch invoices'));
          setLoading(false);
        }
      }
    };

    fetchInvoices();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [realtime, user?.id, isVenueManager, isSuperAdmin, user?.managedVenues?.join(',')]);

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const newInvoice = {
        ...invoiceData,
        invoiceNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const invoiceId = await invoicesCollection.create(newInvoice);
      return invoiceId;
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      throw new Error(getFirebaseErrorMessage(err, 'Failed to create invoice'));
    }
  };

  const updateInvoice = async (invoiceId: string, updates: Partial<Invoice>) => {
    try {
      await invoicesCollection.update(invoiceId, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Error updating invoice:', err);
      throw new Error(getFirebaseErrorMessage(err, 'Failed to update invoice'));
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      await invoicesCollection.delete(invoiceId);
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      throw new Error(getFirebaseErrorMessage(err, 'Failed to delete invoice'));
    }
  };

  return {
    invoices,
    loading,
    error,
    createInvoice,
    updateInvoice,
    deleteInvoice
  };
};
