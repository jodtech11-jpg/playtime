import { useState, useEffect } from 'react';
import { tournamentsCollection } from '../services/firebase';
import { Tournament } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { vendorIdFilter } from '../utils/vendorScope';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseTournamentsOptions {
  venueId?: string;
  status?: Tournament['status'];
  realtime?: boolean;
}

export const useTournaments = (options: UseTournamentsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isVenueManager && !user.id) {
      setTournaments([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchTournaments = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: { field: string; operator: string; value: unknown }[] = [];

        if (isVenueManager && user.id) {
          filters.push(vendorIdFilter(user.id));
          if (options.venueId) {
            filters.push({
              field: 'venueId',
              operator: '==',
              value: options.venueId,
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
          unsubscribe = tournamentsCollection.subscribeAll(
            (data: Tournament[]) => {
              if (!mounted) return;
              setTournaments(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await tournamentsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          if (!mounted) return;
          setTournaments(data as Tournament[]);
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching tournaments:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch tournaments'));
        setLoading(false);
      }
    };

    fetchTournaments();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, options.venueId, options.status, options.realtime, isVenueManager]);

  return { tournaments, loading, error };
};

