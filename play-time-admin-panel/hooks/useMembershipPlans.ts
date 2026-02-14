import { useState, useEffect } from 'react';
import { membershipPlansCollection } from '../services/firebase';
import { MembershipPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

    const fetchPlans = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        // Filter by venue if venue manager
        if (isVenueManager && user.managedVenues && user.managedVenues.length > 0) {
          filters.push({
            field: 'venueId',
            operator: 'in',
            value: user.managedVenues
          });
        } else if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
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

        if (options.realtime) {
          const unsubscribe = membershipPlansCollection.subscribeAll(
            (data: MembershipPlan[]) => {
              setPlans(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await membershipPlansCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          setPlans(data as MembershipPlan[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching membership plans:', err);
        setError(err.message || 'Failed to fetch membership plans');
        setLoading(false);
      }
    };

    fetchPlans();
  }, [user, options.venueId, options.isActive, options.realtime, isVenueManager]);

  return { plans, loading, error };
};

