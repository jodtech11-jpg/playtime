import { useState, useEffect } from 'react';
import { invoicesCollection } from '../services/firebase';
import { Invoice } from '../types';
import { serverTimestamp } from 'firebase/firestore';

export const useInvoices = (realtime: boolean = false) => {
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

        if (realtime) {
          unsubscribe = invoicesCollection.subscribeAll(
            (data: Invoice[]) => {
              if (mounted) {
                setInvoices(data || []);
                setLoading(false);
              }
            },
            undefined,
            'createdAt',
            'desc',
            (subscribeError: any) => {
              console.error('Error in subscription:', subscribeError);
              if (mounted) {
                setError(subscribeError.message || 'Failed to subscribe to invoices');
                setInvoices([]);
                setLoading(false);
              }
            }
          );
        } else {
          const data = await invoicesCollection.getAll(
            undefined,
            'createdAt',
            'desc'
          );
          if (mounted) {
            setInvoices(data as Invoice[]);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching invoices:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch invoices');
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
  }, [realtime]);

  const createInvoice = async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const newInvoice = {
        ...invoiceData,
        invoiceNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await invoicesCollection.create(newInvoice);
      return docRef.id;
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      throw new Error(err.message || 'Failed to create invoice');
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
      throw new Error(err.message || 'Failed to update invoice');
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      await invoicesCollection.delete(invoiceId);
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      throw new Error(err.message || 'Failed to delete invoice');
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

