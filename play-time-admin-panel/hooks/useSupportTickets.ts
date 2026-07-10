import { useState, useEffect } from 'react';
import { supportTicketsCollection } from '../services/firebase';
import { SupportTicket } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseSupportTicketsOptions {
  status?: SupportTicket['status'];
  priority?: SupportTicket['priority'];
  type?: SupportTicket['type'];
  userId?: string;
  limit?: number;
  realtime?: boolean;
}

const sortByCreatedDesc = (rows: SupportTicket[]) =>
  [...rows].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });

const mergeById = (lists: SupportTicket[][]): SupportTicket[] => {
  const map = new Map<string, SupportTicket>();
  lists.flat().forEach((t) => {
    if (t?.id) map.set(t.id, t);
  });
  return sortByCreatedDesc(Array.from(map.values()));
};

export const useSupportTickets = (options: UseSupportTicketsOptions = {}) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    let mounted = true;

    const baseFilters = (): { field: string; operator: string; value: unknown }[] => {
      const filters: { field: string; operator: string; value: unknown }[] = [];
      if (options.status) {
        filters.push({ field: 'status', operator: '==', value: options.status });
      }
      if (options.priority) {
        filters.push({ field: 'priority', operator: '==', value: options.priority });
      }
      if (options.type) {
        filters.push({ field: 'type', operator: '==', value: options.type });
      }
      if (options.userId) {
        filters.push({ field: 'userId', operator: '==', value: options.userId });
      }
      return filters;
    };

    const fetchTickets = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          if (mounted) {
            setTickets([]);
            setLoading(false);
          }
          return;
        }

        // Vendors: only tickets for managed venues (plus tickets assigned to them).
        // Super admins: full collection.
        if (isVenueManager && !isSuperAdmin) {
          const managed = user.managedVenues?.filter(Boolean) ?? [];
          if (managed.length === 0) {
            if (mounted) {
              setTickets([]);
              setLoading(false);
            }
            return;
          }

          const venueFilters = [
            ...baseFilters(),
            { field: 'venueId', operator: 'in', value: managed.slice(0, 30) },
          ];
          const assignedFilters = [
            ...baseFilters(),
            { field: 'assignedTo', operator: '==', value: user.id },
          ];

          if (options.realtime) {
            let venueRows: SupportTicket[] = [];
            let assignedRows: SupportTicket[] = [];
            const publish = () => {
              if (!mounted) return;
              setTickets(mergeById([venueRows, assignedRows]));
              setLoading(false);
            };

            unsubscribers.push(
              supportTicketsCollection.subscribeAll(
                (data: SupportTicket[]) => {
                  venueRows = data || [];
                  publish();
                },
                venueFilters
              )
            );
            unsubscribers.push(
              supportTicketsCollection.subscribeAll(
                (data: SupportTicket[]) => {
                  assignedRows = data || [];
                  publish();
                },
                assignedFilters
              )
            );
          } else {
            const [venueData, assignedData] = await Promise.all([
              supportTicketsCollection.getAll(venueFilters, undefined, undefined, options.limit),
              supportTicketsCollection.getAll(assignedFilters, undefined, undefined, options.limit),
            ]);
            if (!mounted) return;
            setTickets(mergeById([venueData as SupportTicket[], assignedData as SupportTicket[]]));
            setLoading(false);
          }
          return;
        }

        // Super admin (and any other admin-panel role without venue scoping)
        const filters = baseFilters();
        if (options.realtime) {
          unsubscribers.push(
            supportTicketsCollection.subscribeAll(
              (data: SupportTicket[]) => {
                if (!mounted) return;
                setTickets(sortByCreatedDesc(data || []));
                setLoading(false);
              },
              filters.length > 0 ? filters : undefined
            )
          );
        } else {
          const data = await supportTicketsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            options.limit
          );
          if (!mounted) return;
          setTickets(sortByCreatedDesc(data as SupportTicket[]));
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching support tickets:', err);
        if (!mounted) return;
        setError(getFirebaseErrorMessage(err, 'Failed to fetch support tickets'));
        setLoading(false);
      }
    };

    fetchTickets();

    return () => {
      mounted = false;
      unsubscribers.forEach((u) => u());
    };
  }, [
    user?.id,
    isVenueManager,
    isSuperAdmin,
    user?.managedVenues?.join(','),
    options.status,
    options.priority,
    options.type,
    options.userId,
    options.limit,
    options.realtime,
  ]);

  return { tickets, loading, error };
};
