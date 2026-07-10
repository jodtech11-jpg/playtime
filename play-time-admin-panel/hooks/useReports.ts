import { useState, useEffect } from 'react';
import { reportsCollection } from '../services/firebase';
import { Report } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseReportsOptions {
  postId?: string;
  status?: Report['status'];
  limit?: number;
  realtime?: boolean;
}

export const useReports = (options: UseReportsOptions = {}) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        // Filter by post
        if (options.postId) {
          filters.push({
            field: 'postId',
            operator: '==',
            value: options.postId
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
          unsubscribe = reportsCollection.subscribeAll(
            (data: Report[]) => {
              if (!mounted) return;
              setReports(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await reportsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          );
          if (!mounted) return;
          setReports(data as Report[]);
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching reports:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch reports'));
        setLoading(false);
      }
    };

    fetchReports();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, options.postId, options.status, options.limit, options.realtime]);

  return { reports, loading, error };
};

// Hook for pending reports
export const usePendingReports = () => {
  return useReports({
    status: 'Pending',
    realtime: true
  });
};

