import { useState, useEffect } from 'react';
import { supportTicketsCollection } from '../services/firebase';
import { SupportTicket } from '../types';

interface UseSupportTicketsOptions {
  status?: SupportTicket['status'];
  priority?: SupportTicket['priority'];
  type?: SupportTicket['type'];
  userId?: string;
  limit?: number;
  realtime?: boolean;
}

export const useSupportTickets = (options: UseSupportTicketsOptions = {}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchTickets = async () => {
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

        if (options.priority) {
          filters.push({
            field: 'priority',
            operator: '==',
            value: options.priority
          });
        }

        if (options.type) {
          filters.push({
            field: 'type',
            operator: '==',
            value: options.type
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
          unsubscribe = supportTicketsCollection.subscribeAll(
            (data: SupportTicket[]) => {
              setTickets(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await supportTicketsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          ) as SupportTicket[];
          setTickets(data);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching support tickets:', err);
        setError(err.message || 'Failed to fetch support tickets');
        setLoading(false);
      }
    };

    fetchTickets();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.status, options.priority, options.type, options.userId, options.limit, options.realtime]);

  return { tickets, loading, error };
};

