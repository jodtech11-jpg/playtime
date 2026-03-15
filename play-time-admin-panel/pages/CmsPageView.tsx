import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCmsPageBySlug } from '../hooks/useCmsPageBySlug';
import { CmsPage } from '../types';

/** Format Firestore timestamp or date for display */
function formatUpdatedAt(updatedAt: CmsPage['updatedAt']): string | null {
  if (!updatedAt) return null;
  try {
    const date = updatedAt?.toDate?.() ?? (typeof updatedAt === 'object' && updatedAt && 'seconds' in updatedAt
      ? new Date((updatedAt as { seconds: number }).seconds * 1000)
      : new Date(updatedAt as string | number));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

/** Slugify for anchor ids */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Public page that renders a single Frontend CMS page by URL slug.
 * Used for routes like /#/page/terms, /#/page/about-us.
 */
const CmsPageView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { page, loading, error } = useCmsPageBySlug(slug ?? undefined, true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Extract headings and add ids for TOC + scroll
  useEffect(() => {
    if (!page?.body || !contentRef.current) return;
    const el = contentRef.current;
    const headings = el.querySelectorAll('h2, h3');
    const entries: { id: string; text: string; level: number }[] = [];
    headings.forEach((h, i) => {
      const id = h.id || `section-${slugify(h.textContent || '')}-${i}`;
      h.id = id;
      entries.push({
        id,
        text: h.textContent?.trim() || '',
        level: h.tagName === 'H2' ? 2 : 3,
      });
    });
    setToc(entries);
  }, [page?.id, page?.body, slug]);

  // Back-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen mesh-gradient text-slate-900 dark:text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen mesh-gradient text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">description</span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Page not found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error || 'This page does not exist or is not published.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const hasHtml = page.body && /<[a-z][\s\S]*>/i.test(page.body);
  const lastUpdated = formatUpdatedAt(page.updatedAt);

  // Plain text: split into paragraphs for automatic neat arrangement
  const plainTextParagraphs =
    page.body && !hasHtml
      ? page.body
          .trim()
          .split(/\n\s*\n/)
          .filter((block) => block.trim())
      : [];

  return (
    <div className="min-h-screen mesh-gradient text-slate-900 dark:text-slate-100">
      {/* Nav – same style as Landing */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/20 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-white text-3xl font-bold">sports_tennis</span>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tighter block leading-none">PLAY TIME</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Intelligence</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 text-slate-700 dark:text-slate-300 font-bold text-sm hover:text-primary transition-colors"
          >
            Back to home
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors mb-6"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Home
          </button>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200/80 dark:border-slate-600/50 flex items-center justify-center shadow-lg shrink-0">
              <span className="material-symbols-outlined text-3xl text-primary">description</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {page.title}
              </h1>
              {page.description && (
                <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-2xl">
                  {page.description}
                </p>
              )}
              {lastUpdated && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main content + optional TOC */}
      <main className="pb-24 px-6">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-10">
          {toc.length > 0 && (
            <aside className="lg:w-56 shrink-0 order-2 lg:order-1">
              <div className="lg:sticky lg:top-28 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur border border-slate-200/80 dark:border-slate-600/50 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  On this page
                </p>
                <nav className="space-y-1.5">
                  {toc.map(({ id, text, level }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className={`block text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary transition-colors ${level === 3 ? 'pl-3 border-l-2 border-slate-200 dark:border-slate-600' : ''}`}
                    >
                      {text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          <article className="flex-1 min-w-0 order-1 lg:order-2">
            <div
              className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200/80 dark:border-slate-600/50 shadow-xl overflow-hidden"
            >
              <div className="p-8 md:p-10 lg:p-12">
                <div
                  ref={contentRef}
                  className="cms-prose prose prose-slate dark:prose-invert prose-lg max-w-none
                    prose-headings:font-black prose-headings:scroll-mt-28
                    prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-600
                    prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                    prose-p:leading-relaxed prose-p:text-slate-700 dark:prose-p:text-slate-300
                    prose-ul:my-6 prose-ol:my-6 prose-li:my-1
                    prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-bold
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                    prose-blockquote:border-l-primary prose-blockquote:bg-slate-50 dark:prose-blockquote:bg-slate-800/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-xl"
                  {...(page.body && hasHtml ? { dangerouslySetInnerHTML: { __html: page.body } } : {})}
                >
                  {plainTextParagraphs.length > 0 &&
                    plainTextParagraphs.map((block, i) => (
                      <p
                        key={i}
                        className="leading-relaxed text-slate-700 dark:text-slate-300 mb-5 last:mb-0"
                      >
                        {block.split(/\n/).map((line, j) => (
                          <React.Fragment key={j}>
                            {j > 0 && <br />}
                            {line.trim()}
                          </React.Fragment>
                        ))}
                      </p>
                    ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover transition-all hover:scale-110 flex items-center justify-center"
          aria-label="Back to top"
        >
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-white/5 opacity-60">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 grayscale opacity-50">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center">
              <span className="material-symbols-outlined text-white dark:text-slate-900 text-xl font-bold">sports_tennis</span>
            </div>
            <span className="text-lg font-black tracking-tighter">PLAY TIME</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest">
            © 2026 Play Time Global. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CmsPageView;
