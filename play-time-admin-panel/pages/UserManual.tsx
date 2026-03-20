import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import manualMarkdown from '../../USER_MANUAL.md?raw';

/** Matches long-form styling in `CmsPageView` (CMS pages) so the manual feels like the rest of the app. */
const manualProseClassName = [
  'cms-prose prose prose-slate dark:prose-invert prose-lg max-w-none',
  'prose-headings:font-black prose-headings:scroll-mt-28',
  'prose-h1:text-3xl prose-h1:tracking-tight prose-h1:mt-0 prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-200 dark:prose-h1:border-slate-600',
  'prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-600',
  'prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3',
  'prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-2 prose-h4:font-bold',
  'prose-p:leading-relaxed prose-p:text-slate-700 dark:prose-p:text-slate-300',
  'prose-ul:my-6 prose-ol:my-6 prose-li:my-1',
  'prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-bold',
  'prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-medium',
  'prose-blockquote:border-l-primary prose-blockquote:bg-slate-50 dark:prose-blockquote:bg-slate-800/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-xl',
  'prose-hr:border-slate-200 dark:prose-hr:border-slate-600 prose-hr:my-10',
  'prose-code:text-sm prose-code:font-medium prose-code:bg-slate-100 dark:prose-code:bg-slate-900/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:bg-slate-100 dark:prose-pre:bg-slate-900/60 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-600 prose-pre:rounded-xl',
  'prose-table:text-sm prose-th:bg-slate-100 dark:prose-th:bg-slate-900/50 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
].join(' ');

const UserManual: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 pb-20 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          User manual
        </h1>
        <p className="text-slate-500 dark:text-gray-400 text-sm font-medium max-w-2xl">
          Play Time product guide — mobile app, venue managers, and super admins. Updated with the same
          documentation file shipped in the repository.
        </p>
      </div>

      <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200/80 dark:border-slate-600/50 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-8 md:p-10 lg:p-12">
          <div className={manualProseClassName}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{manualMarkdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
