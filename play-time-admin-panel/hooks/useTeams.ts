import { useState, useEffect } from 'react';
import { teamsCollection } from '../services/firebase';

interface UseTeamsOptions {
  userId?: string;
  sport?: string;
  limit?: number;
  realtime?: boolean;
}

export interface Team {
  id: string;
  name: string;
  sport: string;
  createdBy: string;
  members: string[];
  createdAt?: any;
  updatedAt?: any;
}

export const useTeams = (options: UseTeamsOptions = {}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchTeams = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (options.userId) {
          // Note: For teams, we need to check both createdBy and members
          // Since array-contains can only be used once per query, we'll filter in memory
          // Or we can use a different approach - query by createdBy OR filter members in memory
          // For now, let's query all teams and filter in memory for members
          // This is less efficient but works for now
        }

        if (options.sport) {
          filters.push({
            field: 'sport',
            operator: '==',
            value: options.sport
          });
        }

        if (options.realtime) {
          unsubscribe = teamsCollection.subscribeAll(
            (data: Team[]) => {
              // Filter by userId in memory (check both createdBy and members)
              let filtered = data;
              if (options.userId) {
                filtered = data.filter(team => 
                  team.createdBy === options.userId || 
                  (team.members && team.members.includes(options.userId))
                );
              }
              if (options.sport) {
                filtered = filtered.filter(team => team.sport === options.sport);
              }
              setTeams(filtered);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          let data = await teamsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          ) as Team[];
          
          // Filter by userId in memory (check both createdBy and members)
          if (options.userId) {
            data = data.filter(team => 
              team.createdBy === options.userId || 
              (team.members && team.members.includes(options.userId))
            );
          }
          
          setTeams(data);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching teams:', err);
        setError(err.message || 'Failed to fetch teams');
        setLoading(false);
      }
    };

    fetchTeams();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.userId, options.sport, options.limit, options.realtime]);

  return { teams, loading, error };
};

