import { useState, useEffect } from 'react';
import { venuesCollection } from '../services/firebase';
import { Venue } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseVenuesOptions {
  realtime?: boolean;
  status?: Venue['status'];
}

export const useVenues = (options: UseVenuesOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchVenues = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        // Filter by managed venues if venue manager
        if (isVenueManager && user.managedVenues && user.managedVenues.length > 0) {
          filters.push({
            field: 'id',
            operator: 'in',
            value: user.managedVenues
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
          unsubscribe = venuesCollection.subscribeAll(
            (data: Venue[]) => {
              if (mounted) {
                setVenues(data);
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await venuesCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (mounted) {
            setVenues(data as Venue[]);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching venues:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch venues');
          setLoading(false);
        }
      }
    };

    fetchVenues();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id, options.status, options.realtime, isVenueManager]);

  return { venues, loading, error };
};

