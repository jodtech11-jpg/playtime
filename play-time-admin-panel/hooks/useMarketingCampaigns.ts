import { useState, useEffect } from 'react';
import { marketingCampaignsCollection } from '../services/firebase';
import { MarketingCampaign } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

interface UseMarketingCampaignsOptions {
  type?: MarketingCampaign['type'];
  status?: MarketingCampaign['status'];
  venueId?: string;
  limit?: number;
  realtime?: boolean;
}

const sortByCreatedDesc = (rows: MarketingCampaign[]) =>
  [...rows].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });

export const useMarketingCampaigns = (options: UseMarketingCampaignsOptions = {}) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          if (mounted) {
            setCampaigns([]);
            setLoading(false);
          }
          return;
        }

        const filters: { field: string; operator: string; value: unknown }[] = [];

        if (options.type) {
          filters.push({ field: 'type', operator: '==', value: options.type });
        }
        if (options.status) {
          filters.push({ field: 'status', operator: '==', value: options.status });
        }
        if (options.venueId) {
          filters.push({ field: 'venueId', operator: '==', value: options.venueId });
        }

        const scopeForVendor = (rows: MarketingCampaign[]) => {
          if (!isVenueManager || isSuperAdmin) return rows;
          const managed = new Set(user.managedVenues?.filter(Boolean) ?? []);
          return rows.filter(
            (c) =>
              c.type === 'Global' ||
              (c.venueId != null && managed.has(c.venueId))
          );
        };

        if (options.realtime) {
          unsubscribe = marketingCampaignsCollection.subscribeAll(
            (data: MarketingCampaign[]) => {
              if (!mounted) return;
              setCampaigns(sortByCreatedDesc(scopeForVendor(data || [])));
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined
          );
        } else {
          const data = await marketingCampaignsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            options.limit
          );
          if (!mounted) return;
          setCampaigns(sortByCreatedDesc(scopeForVendor(data as MarketingCampaign[])));
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching marketing campaigns:', err);
        if (!mounted) return;
        setError(getFirebaseErrorMessage(err, 'Failed to fetch marketing campaigns'));
        setLoading(false);
      }
    };

    fetchCampaigns();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    user?.id,
    isVenueManager,
    isSuperAdmin,
    user?.managedVenues?.join(','),
    options.type,
    options.status,
    options.venueId,
    options.limit,
    options.realtime,
  ]);

  return { campaigns, loading, error };
};
