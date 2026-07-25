import { useState, useEffect } from 'react';
import { staffCollection } from '../services/firebase';
import { Staff } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseStaffOptions {
  venueId?: string;
  status?: Staff['status'];
  realtime?: boolean;
}

export const useStaff = (options: UseStaffOptions = {}) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const fetchStaff = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        const managed = user.managedVenues?.filter(Boolean) ?? [];
        // Vendors are scoped by managed venue; Super Admin sees platform staff only.
        if (isVenueManager && !isSuperAdmin) {
          if (managed.length === 0) {
            setStaff([]);
            setLoading(false);
            return;
          }
          if (options.venueId && !managed.includes(options.venueId)) {
            setStaff([]);
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
                'useStaff: venue manager has more than 30 managedVenues; only the first 30 are queried.'
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

        const applyOwnershipScope = (rows: Staff[]) => {
          if (isSuperAdmin) {
            // Super Admin sees platform staff only — never vendor/venue staff.
            return rows.filter((member) => {
              if (member.ownerScope === 'platform') return true;
              if (member.ownerScope === 'vendor') return false;
              // Legacy rows without ownerScope: venue-assigned = vendor staff.
              if (member.venueId) return false;
              return true;
            });
          }
          if (isVenueManager) {
            // Venue staff remain with the venue when management is reassigned.
            return rows.filter((member) => member.ownerScope !== 'platform');
          }
          return [];
        };

        if (options.realtime) {
          // Sort in memory — avoid orderBy('createdAt') so venue managers don't
          // need a composite index (venueId + createdAt) just to list staff.
          unsubscribe = staffCollection.subscribeAll(
            (data: Staff[]) => {
              if (!mounted) return;
              const sorted = applyOwnershipScope(data).sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
                const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
                return bTime - aTime;
              });
              setStaff(sorted);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await staffCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (!mounted) return;
          const sorted = applyOwnershipScope(data as Staff[]).sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
            return bTime - aTime;
          });
          setStaff(sorted);
          setLoading(false);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error fetching staff:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch staff'));
        setLoading(false);
      }
    };

    fetchStaff();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, options.venueId, options.status, options.realtime, isVenueManager, isSuperAdmin]);

  return { staff, loading, error };
};

// Hook for active staff
export const useActiveStaff = () => {
  return useStaff({
    status: 'Active',
    realtime: true
  });
};

