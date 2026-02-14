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

    const fetchMemberships = async () => {
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

        // Filter by status
        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        if (options.realtime) {
          const unsubscribe = membershipsCollection.subscribeAll(
            (data: Membership[]) => {
              setMemberships(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await membershipsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          setMemberships(data as Membership[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching memberships:', err);
        setError(err.message || 'Failed to fetch memberships');
        setLoading(false);
      }
    };

    fetchMemberships();
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

