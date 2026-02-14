import { useState, useEffect } from 'react';
import { marketingCampaignsCollection } from '../services/firebase';
import { MarketingCampaign } from '../types';

interface UseMarketingCampaignsOptions {
  type?: MarketingCampaign['type'];
  status?: MarketingCampaign['status'];
  venueId?: string;
  limit?: number;
  realtime?: boolean;
}

export const useMarketingCampaigns = (options: UseMarketingCampaignsOptions = {}) => {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        const filters: any[] = [];

        if (options.type) {
          filters.push({
            field: 'type',
            operator: '==',
            value: options.type
          });
        }

        if (options.status) {
          filters.push({
            field: 'status',
            operator: '==',
            value: options.status
          });
        }

        if (options.venueId) {
          filters.push({
            field: 'venueId',
            operator: '==',
            value: options.venueId
          });
        }

        if (options.realtime) {
          unsubscribe = marketingCampaignsCollection.subscribeAll(
            (data: MarketingCampaign[]) => {
              setCampaigns(data);
              setLoading(false);
            },
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc'
          );
        } else {
          const data = await marketingCampaignsCollection.getAll(
            filters.length > 0 ? filters : undefined,
            'createdAt',
            'desc',
            options.limit
          ) as MarketingCampaign[];
          setCampaigns(data);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching marketing campaigns:', err);
        setError(err.message || 'Failed to fetch marketing campaigns');
        setLoading(false);
      }
    };

    fetchCampaigns();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [options.type, options.status, options.venueId, options.limit, options.realtime]);

  return { campaigns, loading, error };
};

