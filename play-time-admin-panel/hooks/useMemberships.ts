import { useState, useEffect } from 'react';
import { membershipsCollection } from '../services/firebase';
import { Membership } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseMembershipsOptions {
  venueId?: string;
  status?: Membership['status'];
  realtime?: boolean;
}

export const useMemberships = (options: UseMembershipsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribeRef: (() => void) | undefined;

    const fetchMemberships = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            if (mounted) {
              setMemberships([]);
              setLoading(false);
            }
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            if (mounted) {
              setMemberships([]);
              setLoading(false);
            }
            return;
          }
          if (options.venueId) {
            filters.push({
              field: 'venueId',
              operator: '==',
              value: options.venueId,
            });
          } else {
            const ids = managed.slice(0, 10);
            if (managed.length > 10) {
              console.warn(
                'useMemberships: venue manager has more than 10 managedVenues; only the first 10 are queried.'
              );
            }
            filters.push({
              field: 'venueId',
              operator: 'in',
              value: ids,
            });
          }
        } else if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId,
          });
        }

        // Filter by status
        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        if (options.realtime) {
          unsubscribeRef = membershipsCollection.subscribeAll(
            (data: Membership[]) => {
              if (!mounted) return;
              setMemberships(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await membershipsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          if (!mounted) return;
          setMemberships(data as Membership[]);
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching memberships:', err);
        setError(err.message || 'Failed to fetch memberships');
        setLoading(false);
      }
    };

    fetchMemberships();

    return () => {
      mounted = false;
      if (unsubscribeRef) unsubscribeRef();
    };
  }, [user, options.venueId, options.status, options.realtime, isVenueManager]);

  return { memberships, loading, error };
};

// Hook for active memberships
export const useActiveMemberships = () => {
  return useMemberships({
    status: 'Active',
    realtime: true
  });
};

