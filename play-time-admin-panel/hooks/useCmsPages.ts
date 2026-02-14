import { useState, useEffect } from 'react';
import { cmsPagesCollection } from '../services/firebase';
import { CmsPage } from '../types';

interface UseCmsPagesOptions {
  realtime?: boolean;
  activeOnly?: boolean;
}

export const useCmsPages = (options: UseCmsPagesOptions = {}) => {
  const { realtime = true, activeOnly = false } = options;
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (realtime) {
      const unsubscribe = cmsPagesCollection.subscribeAll(
        (data: CmsPage[]) => {
          let list = [...(data || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          if (activeOnly) {
            list = list.filter((p) => p.isActive);
          }
          setPages(list);
          setLoading(false);
        },
        activeOnly ? [{ field: 'isActive', operator: '==', value: true }] : undefined,
        'order',
        'asc'
      );
      return () => unsubscribe();
    }

    const fetch = async () => {
      try {
        setLoading(true);
        const list = await cmsPagesCollection.getAll(
          activeOnly ? [{ field: 'isActive', operator: '==', value: true }] : undefined,
          'order',
          'asc'
        );
        setPages((list as CmsPage[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      } catch (err: any) {
        setError(err.message);
        setPages([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [realtime, activeOnly]);

  return { pages, loading, error };
};
