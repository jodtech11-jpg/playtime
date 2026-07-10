import { useState, useEffect } from 'react';
import { membershipsCollection } from '../services/firebase';
import { Membership } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseMembershipsOptions {
  venueId?: string;
  status?: Membership['status'];
  realtime?: boolean;
  enabled?: boolean;
}

export const useMemberships = (options: UseMembershipsOptions = {}) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.enabled === false) {
      setMemberships([]);
      setLoading(false);
      return;
    }
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
            // Firestore `in` supports up to 30 values
            const ids = managed.slice(0, 30);
            if (managed.length > 30) {
              console.warn(
                'useMemberships: venue manager has more than 30 managedVenues; only the first 30 are queried.'
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

        const sortByCreatedDesc = (rows: Membership[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });

        // Sort in memory — venueId + orderBy(createdAt) needs a composite index
        // that vendors hit and super-admins (unfiltered) do not.
        if (options.realtime) {
          unsubscribeRef = membershipsCollection.subscribeAll(
            (data: Membership[]) => {
              if (!mounted) return;
              setMemberships(sortByCreatedDesc(data));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await membershipsCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          setMemberships(sortByCreatedDesc(data as Membership[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching memberships:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch memberships'));
        setLoading(false);
      }
    };

    fetchMemberships();

    return () => {
      mounted = false;
      if (unsubscribeRef) unsubscribeRef();
    };
  }, [user, options.venueId, options.status, options.realtime, options.enabled, isVenueManager, isSuperAdmin]);

  return { memberships, loading, error };
};

// Hook for active memberships
export const useActiveMemberships = () => {
  return useMemberships({
    status: 'Active',
    realtime: true
  });
};

