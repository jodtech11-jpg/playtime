import { useState, useEffect } from 'react';
import { postsCollection } from '../services/firebase';
import { Post } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UsePostsOptions {
  venueId?: string;
  status?: Post['status'];
  type?: Post['type'];
  isReported?: boolean;
  limit?: number;
  realtime?: boolean;
}

export const usePosts = (options: UsePostsOptions = {}) => {
  const { user, isVenueManager } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchPosts = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        if (isVenueManager) {
          if (managed.length === 0) {
            setPosts([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setPosts([]);
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
                'usePosts: venue manager has more than 30 managedVenues; only the first 30 are queried.'
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

        // Filter by status
        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        // Filter by type
        if (options.type) {
          filters.push({
            field: 'type',
            operator: '==',
            value: options.type
          });
        }

        // Filter by reported
        if (options.isReported !== undefined) {
          filters.push({
            field: 'isReported',
            operator: '==',
            value: options.isReported
          });
        }

        if (options.realtime) {
          unsubscribe = postsCollection.subscribeAll(
            (data: Post[]) => {
              if (!mounted) return;
              setPosts(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await postsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          );
          if (!mounted) return;
          setPosts(data as Post[]);
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching posts:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch posts'));
        setLoading(false);
      }
    };

    fetchPosts();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, options.venueId, options.status, options.type, options.isReported, options.limit, options.realtime, isVenueManager]);

  return { posts, loading, error };
};

// Hook for pending posts
export const usePendingPosts = () => {
  return usePosts({
    status: 'Pending',
    realtime: true
  });
};

// Hook for reported posts
export const useReportedPosts = () => {
  return usePosts({
    isReported: true,
    realtime: true
  });
};

