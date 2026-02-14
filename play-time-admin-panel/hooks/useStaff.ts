import { useState, useEffect } from 'react';
import { staffCollection } from '../services/firebase';
import { Staff } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseStaffOptions {
  venueId?: string;
  status?: Staff['status'];
  realtime?: boolean;
}

export const useStaff = (options: UseStaffOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStaff = async () => {
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
          const unsubscribe = staffCollection.subscribeAll(
            (data: Staff[]) => {
              setStaff(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await staffCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          setStaff(data as Staff[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching staff:', err);
        setError(err.message || 'Failed to fetch staff');
        setLoading(false);
      }
    };

    fetchStaff();
  }, [user, options.venueId, options.status, options.realtime, isVenueManager]);

  return { staff, loading, error };
};

// Hook for active staff
export const useActiveStaff = () => {
  return useStaff({
    status: 'Active',
    realtime: true
  });
};

