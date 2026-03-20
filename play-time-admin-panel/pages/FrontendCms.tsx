import React, { useState, useEffect } from 'react';
import { CmsPage } from '../types';
import { useCmsPages } from '../hooks/useCmsPages';
import { cmsPagesCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import CmsPageFormModal from '../components/modals/CmsPageFormModal';

const FrontendCms: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { pages, loading } = useCmsPages({ realtime: true });
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPage, setEditingPage] = useState<CmsPage | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const handleAddPage = () => {
    setEditingPage(null);
    setShowFormModal(true);
  };

  const handleEditPage = (page: CmsPage) => {
    setEditingPage(page);
    setShowFormModal(true);
  };

  const handleSavePage = async (data: Partial<CmsPage>) => {
    try {
      setProcessing('saving');
      if (editingPage) {
        await cmsPagesCollection.update(editingPage.id, {
          ...data,
          updatedAt: serverTimestamp(),
          updatedBy: user?.id,
        });
        showSuccess('Page updated successfully');
      } else {
        await cmsPagesCollection.create({
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: user?.id,
        });
        showSuccess('Page created successfully');
      }
      setShowFormModal(false);
      setEditingPage(null);
    } catch (err: any) {
      console.error('Error saving CMS page:', err);
      showError('Failed to save: ' + (err?.message || 'Unknown error'));
      throw err;
    } finally {
      setProcessing(null);
    }
  };

  const handleDeletePage = (page: CmsPage) => {
    openConfirm({
      title: 'Delete page?',
      message: `"${page.title}" will be permanently removed.`,
      onConfirm: async () => {
        try {
          setProcessing(page.id);
          await cmsPagesCollection.delete(page.id);
          showSuccess('Page deleted');
        } catch (err: any) {
          console.error('Error deleting CMS page:', err);
          showError('Failed to delete: ' + (err?.message || 'Unknown error'));
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  useEffect(() => {
    setNewEntryHandler(handleAddPage);
    return () => unsetNewEntryHandler();
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const filteredPages = pages.filter((p) => {
    if (filter === 'active') return p.isActive;
    if (filter === 'inactive') return !p.isActive;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Frontend CMS</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage content pages for your frontend (e.g. About, Terms, FAQ).
          </p>
        </div>
        <button
          onClick={handleAddPage}
          className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors font-black text-sm uppercase tracking-wider flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Page
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading pages...</p>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3">description</span>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {pages.length === 0 ? 'No CMS pages yet.' : 'No pages match the filter.'}
            </p>
            {pages.length === 0 && (
              <button
                onClick={handleAddPage}
                className="mt-4 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover"
              >
                Add your first page
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredPages.map((page) => (
              <div
                key={page.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {page.title}
                    </h3>
                    <span className="text-gray-400 dark:text-gray-500 text-sm">/{page.slug}</span>
                    {!page.isActive && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        Draft
                      </span>
                    )}
                  </div>
                  {page.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {page.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEditPage(page)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeletePage(page)}
                    disabled={processing === page.id}
                    className="p-2 rounded-lg text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {processing === page.id ? (
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-xl">delete</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CmsPageFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingPage(null);
        }}
        onSave={handleSavePage}
        page={editingPage}
      />
      {confirmDialog}
    </div>
  );
};

export default FrontendCms;
