import { useState, useEffect } from 'react';
import { cmsPagesCollection } from '../services/firebase';
import { CmsPage } from '../types';

/**
 * Fetch a single CMS page by URL slug (for public page view).
 * Only returns the page if it is active (published).
 */
export const useCmsPageBySlug = (slug: string | undefined, activeOnly = true) => {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !slug.trim()) {
      setPage(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    cmsPagesCollection
      .getBySlug(slug.trim(), activeOnly)
      .then((doc) => {
        if (!cancelled) {
          setPage(doc as CmsPage);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load page');
          setPage(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, activeOnly]);

  return { page, loading, error };
};
