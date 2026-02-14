import { useState, useEffect } from 'react';
import { tournamentsCollection } from '../services/firebase';
import { Tournament } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

    const fetchTournaments = async () => {
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
          const unsubscribe = tournamentsCollection.subscribeAll(
            (data: Tournament[]) => {
              setTournaments(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );

          return () => unsubscribe();
        } else {
          const data = await tournamentsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
          setTournaments(data as Tournament[]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching tournaments:', err);
        setError(err.message || 'Failed to fetch tournaments');
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [user, options.venueId, options.status, options.realtime, isVenueManager]);

  return { tournaments, loading, error };
};

