import { useState, useEffect, useRef, useCallback } from 'react';
import { usersCollection, bookingsCollection, membershipsCollection } from '../services/firebase';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import type { DocumentSnapshot } from 'firebase/firestore';

const USERS_PAGE_SIZE = 50;

interface UseUsersOptions {
  searchTerm?: string;
  limit?: number;
  venueIds?: string[]; // Filter users by venue relationships
  usePagination?: boolean; // When true (default for super_admin), use getPage + Load more
}

export const useUsers = (options: UseUsersOptions = {}) => {
  const { user: currentUser, isVenueManager } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const usePaginated = options.usePagination !== false
    && !isVenueManager
    && (!options.venueIds || options.venueIds.length === 0)
    && !options.searchTerm; // Disable pagination when searching — loadMore has no client-side filter

  const loadMore = useCallback(async () => {
    if (!usePaginated || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const { data, lastDoc } = await usersCollection.getPage(
        undefined,
        'createdAt',
        'desc',
        USERS_PAGE_SIZE,
        lastDocRef.current
      );
      lastDocRef.current = lastDoc;
      setUsers(prev => [...prev, ...(data as User[])]);
      setHasMore(data.length === USERS_PAGE_SIZE);
    } catch (err: any) {
      console.error('Error loading more users:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [usePaginated, loadingMore, hasMore]);

  useEffect(() => {
    if (options.limit === 0) {
      setUsers([]);
      setLoading(false);
      setHasMore(false);
      lastDocRef.current = null;
      return;
    }

    let mounted = true;
    lastDocRef.current = null;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        let userIdsToFetch: string[] | undefined = undefined;

        if (isVenueManager && currentUser?.managedVenues && currentUser.managedVenues.length > 0) {
          const venueIds = options.venueIds || currentUser.managedVenues;
          const bookings = await bookingsCollection.getAll([{ field: 'venueId', operator: 'in', value: venueIds }]) as any[];
          const memberships = await membershipsCollection.getAll([{ field: 'venueId', operator: 'in', value: venueIds }]) as any[];
          const bookingUserIds = new Set(bookings.map(b => b.userId).filter(Boolean));
          const membershipUserIds = new Set(memberships.map(m => m.userId).filter(Boolean));
          const allUsers = await usersCollection.getAll() as User[];
          const managerUserIds = new Set(
            allUsers
              .filter(u =>
                (u.role === 'venue_manager' && u.managedVenues?.some(vId => venueIds.includes(vId))) ||
                (u.role === 'super_admin')
              )
              .map(u => u.id)
          );
          userIdsToFetch = Array.from(new Set([...bookingUserIds, ...membershipUserIds, ...managerUserIds]));
        } else if (options.venueIds && options.venueIds.length > 0) {
          const bookings = await bookingsCollection.getAll([{ field: 'venueId', operator: 'in', value: options.venueIds }]) as any[];
          const memberships = await membershipsCollection.getAll([{ field: 'venueId', operator: 'in', value: options.venueIds }]) as any[];
          const bookingUserIds = new Set(bookings.map(b => b.userId).filter(Boolean));
          const membershipUserIds = new Set(memberships.map(m => m.userId).filter(Boolean));
          userIdsToFetch = Array.from(new Set([...bookingUserIds, ...membershipUserIds]));
        }

        let userData: User[];

        if (userIdsToFetch && userIdsToFetch.length > 0) {
          const userPromises = userIdsToFetch.map(async (userId) => {
            try {
              return await usersCollection.get(userId);
            } catch (err: any) {
              console.error(`Error fetching user ${userId}:`, err.message || err);
              return null;
            }
          });
          const userResults = await Promise.all(userPromises);
          userData = userResults.filter(Boolean) as User[];
          if (!mounted) return;
          let filtered = userData;
          if (options.searchTerm) {
            const searchLower = options.searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
              u.name?.toLowerCase().includes(searchLower) ||
              u.email?.toLowerCase().includes(searchLower) ||
              u.phone?.toLowerCase().includes(searchLower)
            );
          }
          setUsers(filtered);
          setHasMore(false);
          lastDocRef.current = null;
        } else if (usePaginated) {
          const { data, lastDoc } = await usersCollection.getPage(
            undefined,
            'createdAt',
            'desc',
            USERS_PAGE_SIZE,
            undefined
          );
          if (!mounted) return;
          lastDocRef.current = lastDoc;
          let filtered = (data as User[]);
          if (options.searchTerm) {
            const searchLower = options.searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
              u.name?.toLowerCase().includes(searchLower) ||
              u.email?.toLowerCase().includes(searchLower) ||
              u.phone?.toLowerCase().includes(searchLower)
            );
          }
          setUsers(filtered);
          setHasMore(data.length === USERS_PAGE_SIZE);
        } else {
          userData = await usersCollection.getAll() as User[];
          if (!mounted) return;
          let filtered = userData;
          if (options.searchTerm) {
            const searchLower = options.searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
              u.name?.toLowerCase().includes(searchLower) ||
              u.email?.toLowerCase().includes(searchLower) ||
              u.phone?.toLowerCase().includes(searchLower)
            );
          }
          setUsers(filtered);
          setHasMore(false);
        }

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
    return () => { mounted = false; };
  }, [options.searchTerm, options.limit, options.venueIds, isVenueManager, currentUser?.managedVenues?.join(','), usePaginated]);

  return { users, loading, error, loadMore, hasMore, loadingMore };
};

