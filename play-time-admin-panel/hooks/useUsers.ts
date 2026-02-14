import { useState, useEffect } from 'react';
import { usersCollection, bookingsCollection, membershipsCollection } from '../services/firebase';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseUsersOptions {
  searchTerm?: string;
  limit?: number;
  venueIds?: string[]; // Filter users by venue relationships
}

export const useUsers = (options: UseUsersOptions = {}) => {
  const { user: currentUser, isVenueManager } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip fetch if limit is explicitly 0 (lazy loading)
    if (options.limit === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        let userIdsToFetch: string[] | undefined = undefined;

        // If venue manager, get users related to their managed venues
        if (isVenueManager && currentUser?.managedVenues && currentUser.managedVenues.length > 0) {
          const venueIds = options.venueIds || currentUser.managedVenues;
          
          // Get unique user IDs from bookings
          const bookings = await bookingsCollection.getAll([
            {
              field: 'venueId',
              operator: 'in',
              value: venueIds
            }
          ]) as any[];

          // Get unique user IDs from memberships
          const memberships = await membershipsCollection.getAll([
            {
              field: 'venueId',
              operator: 'in',
              value: venueIds
            }
          ]) as any[];

          // Combine and get unique user IDs
          const bookingUserIds = new Set(bookings.map(b => b.userId).filter(Boolean));
          const membershipUserIds = new Set(memberships.map(m => m.userId).filter(Boolean));
          
          // Get all users to find managers (we need this to find venue managers and super admins)
          // In a production system, you might want to maintain a separate index for this
          const allUsers = await usersCollection.getAll() as User[];
          
          // Include venue managers who manage these venues and all super admins
          const managerUserIds = new Set(
            allUsers
              .filter(u => 
                (u.role === 'venue_manager' && u.managedVenues?.some(vId => venueIds.includes(vId))) ||
                (u.role === 'super_admin')
              )
              .map(u => u.id)
          );

          // Combine all user IDs
          const allUserIds = new Set([
            ...bookingUserIds,
            ...membershipUserIds,
            ...managerUserIds
          ]);

          userIdsToFetch = Array.from(allUserIds);
        } else if (options.venueIds && options.venueIds.length > 0) {
          // If specific venue IDs provided, get users for those venues
          const bookings = await bookingsCollection.getAll([
            {
              field: 'venueId',
              operator: 'in',
              value: options.venueIds
            }
          ]) as any[];

          const memberships = await membershipsCollection.getAll([
            {
              field: 'venueId',
              operator: 'in',
              value: options.venueIds
            }
          ]) as any[];

          const bookingUserIds = new Set(bookings.map(b => b.userId).filter(Boolean));
          const membershipUserIds = new Set(memberships.map(m => m.userId).filter(Boolean));
          userIdsToFetch = Array.from(new Set([...bookingUserIds, ...membershipUserIds]));
        }

        // Fetch users
        let userData: User[];
        if (userIdsToFetch && userIdsToFetch.length > 0) {
          // Fetch specific users by IDs (handle missing users gracefully)
          const userPromises = userIdsToFetch.map(async (userId) => {
            try {
              return await usersCollection.get(userId);
            } catch (err) {
              console.warn(`User ${userId} not found`);
              return null;
            }
          });
          const userResults = await Promise.all(userPromises);
          userData = userResults.filter(Boolean) as User[];
        } else {
          // Fetch all users (for super admin)
          userData = await usersCollection.getAll(
            undefined,
            'createdAt',
            'desc',
            options.limit
          ) as User[];
        }

        if (!mounted) return;

        let filteredUsers = userData;

        // Client-side search filtering
        if (options.searchTerm) {
          const searchLower = options.searchTerm.toLowerCase();
          filteredUsers = filteredUsers.filter(user =>
            user.name?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.phone?.toLowerCase().includes(searchLower)
          );
        }

        setUsers(filteredUsers);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching users:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch users');
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      mounted = false;
    };
  }, [options.searchTerm, options.limit, options.venueIds, isVenueManager, currentUser?.managedVenues?.join(',')]);

  return { users, loading, error };
};

