import { useState, useEffect } from 'react';
import { membershipPlansCollection } from '../services/firebase';
import { MembershipPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseMembershipPlansOptions {
  venueId?: string;
  isActive?: boolean;
  realtime?: boolean;
}

export const useMembershipPlans = (options: UseMembershipPlansOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchPlans = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setPlans([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setPlans([]);
            setLoading(false);
            return;
          }
          if (options.venueId) {
            filters.push({
              field: 'venueId',
              operator: '==',
              value: options.venueId,
            });
          } else {
            const ids = managed.slice(0, 30);
            if (managed.length > 30) {
              console.warn(
                'useMembershipPlans: venue manager has more than 30 managedVenues; only the first 30 are queried.'
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

        // Filter by active status
        if (options.isActive !== undefined) {
          filters.push({
            field: 'isActive',
            operator: '==',
            value: options.isActive
          });
        }

        const sortByCreatedDesc = (rows: MembershipPlan[]) =>
          [...rows].sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });

        if (options.realtime) {
          unsubscribe = membershipPlansCollection.subscribeAll(
            (data: MembershipPlan[]) => {
              if (!mounted) return;
              setPlans(sortByCreatedDesc(data));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await membershipPlansCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          setPlans(sortByCreatedDesc(data as MembershipPlan[]));
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching membership plans:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch membership plans'));
        setLoading(false);
      }
    };

    fetchPlans();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, options.venueId, options.isActive, options.realtime, isVenueManager]);

  return { plans, loading, error };
};

