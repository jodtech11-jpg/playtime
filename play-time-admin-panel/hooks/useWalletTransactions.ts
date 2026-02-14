import { useState, useEffect } from 'react';
import { walletTransactionsCollection } from '../services/firebase';

interface UseWalletTransactionsOptions {
  userId?: string;
  type?: 'Credit' | 'Debit';
  limit?: number;
  realtime?: boolean;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  balanceAfter: number;
  createdAt?: any;
}

export const useWalletTransactions = (options: UseWalletTransactionsOptions = {}) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (options.userId) {
          filters.push({
            field: 'userId',
            operator: '==',
            value: options.userId
          });
        }

        if (options.type) {
          filters.push({
            field: 'type',
            operator: '==',
            value: options.type
          });
        }

        if (options.realtime) {
          unsubscribe = walletTransactionsCollection.subscribeAll(
            (data: WalletTransaction[]) => {
              setTransactions(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await walletTransactionsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          ) as WalletTransaction[];
          setTransactions(data);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching wallet transactions:', err);
        setError(err.message || 'Failed to fetch wallet transactions');
        setLoading(false);
      }
    };

    fetchTransactions();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.userId, options.type, options.limit, options.realtime]);

  return { transactions, loading, error };
};

