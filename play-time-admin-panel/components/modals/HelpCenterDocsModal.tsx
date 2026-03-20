import React, { useState, useEffect } from 'react';
import { appSettingsCollection } from '../../services/firebase';
import { AppSettings } from '../../types';
import { serverTimestamp } from 'firebase/firestore';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface HelpCenterDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpDoc {
  id: string;
  title: string;
  content: string;
  category: 'General' | 'Bookings' | 'Payments' | 'Memberships' | 'Account' | 'Other';
  order: number;
}

const HelpCenterDocsModal: React.FC<HelpCenterDocsModalProps> = ({ isOpen, onClose }) => {
  const [docs, setDocs] = useState<HelpDoc[]>([]);
  const [editingDoc, setEditingDoc] = useState<HelpDoc | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openConfirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen]);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const settings = await appSettingsCollection.get() as AppSettings | null;
      const helpDocs = (settings?.helpCenterDocs || []) as HelpDoc[];
      setDocs(helpDocs.sort((a, b) => a.order - b.order));
    } catch (err: any) {
      console.error('Error loading docs:', err);
      // If settings don't exist, start with empty array
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDoc = async (doc: Omit<HelpDoc, 'id'> & { id?: string }) => {
    try {
      setLoading(true);
      setError(null);

      let settings = await appSettingsCollection.get() as AppSettings | null;
      const currentDocs = (settings?.helpCenterDocs || []) as HelpDoc[];

      let updatedDocs: HelpDoc[];
      if (doc.id) {
        // Update existing
        updatedDocs = currentDocs.map(d => d.id === doc.id ? { ...doc, id: d.id } : d);
      } else {
        // Create new
        const newDoc: HelpDoc = {
          ...doc,
          id: `doc-${Date.now()}`
        };
        updatedDocs = [...currentDocs, newDoc];
      }

      if (settings) {
        await appSettingsCollection.update({
          helpCenterDocs: updatedDocs,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new settings document if it doesn't exist
        await appSettingsCollection.create({
          id: 'platform',
          convenienceFee: 100,
          platformCommission: 0.05,
          cancellationWindowHours: 24,
          bookingBufferMinutes: 15,
          integrations: {
            razorpay: {
              enabled: false,
              status: 'Setup Required'
            },
            whatsapp: {
              enabled: false,
              status: 'Setup Required'
            }
          },
          helpCenterDocs: updatedDocs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await loadDocs();
      setShowForm(false);
      setEditingDoc(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save document');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = (docId: string) => {
    openConfirm({
      title: 'Delete help document?',
      message: 'This cannot be undone.',
      onConfirm: async () => {
        try {
          setLoading(true);
          const settings = await appSettingsCollection.get() as AppSettings | null;
          if (!settings) return;

          const currentDocs = (settings.helpCenterDocs || []) as HelpDoc[];
          const updatedDocs = currentDocs.filter((d) => d.id !== docId);

          await appSettingsCollection.update({
            helpCenterDocs: updatedDocs,
            updatedAt: serverTimestamp(),
          });

          await loadDocs();
        } catch (err: any) {
          setError(err.message || 'Failed to delete document');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {confirmDialog}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Help Center Documentation</h3>
            <p className="text-sm text-gray-500 mt-1">Manage help articles and documentation</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex justify-end mb-6">
            <button
              onClick={() => {
                setEditingDoc(null);
                setShowForm(true);
              }}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all"
            >
              + Add New Document
            </button>
          </div>

          {showForm ? (
            <DocForm
              doc={editingDoc}
              onSave={handleSaveDoc}
              onCancel={() => {
                setShowForm(false);
                setEditingDoc(null);
              }}
              loading={loading}
            />
          ) : (
            <>
              {loading && docs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-gray-600 font-medium">Loading documents...</p>
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">article</span>
                  <p className="text-sm font-medium">No help documents yet</p>
                  <p className="text-xs text-gray-400 mt-1">Create your first help document to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-[9px] font-black uppercase">
                              {doc.category}
                            </span>
                            <span className="text-xs text-gray-400">Order: {doc.order}</span>
                          </div>
                          <h4 className="font-black text-gray-900 mb-2">{doc.title}</h4>
                          <p className="text-sm text-gray-600 line-clamp-3">{doc.content}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingDoc(doc);
                              setShowForm(true);
                            }}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase hover:bg-gray-50 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-all disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

interface DocFormProps {
  doc: HelpDoc | null;
  onSave: (doc: Omit<HelpDoc, 'id'> & { id?: string }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const DocForm: React.FC<DocFormProps> = ({ doc, onSave, onCancel, loading }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<HelpDoc['category']>('General');
  const [order, setOrder] = useState<string>('0');

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setCategory(doc.category);
      setOrder(doc.order.toString());
    } else {
      setTitle('');
      setContent('');
      setCategory('General');
      setOrder('0');
    }
  }, [doc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    await onSave({
      id: doc?.id,
      title: title.trim(),
      content: content.trim(),
      category,
      order: parseInt(order) || 0
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g., How to Book a Court"
          required
        />
      </div>

      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
          Category *
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as HelpDoc['category'])}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          <option value="General">General</option>
          <option value="Bookings">Bookings</option>
          <option value="Payments">Payments</option>
          <option value="Memberships">Memberships</option>
          <option value="Account">Account</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
          Display Order
        </label>
        <input
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          min="0"
        />
        <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
      </div>

      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
          Content *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Enter the help document content..."
          rows={10}
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim() || !content.trim()}
          className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : doc ? 'Update Document' : 'Create Document'}
        </button>
      </div>
    </form>
  );
};

export default HelpCenterDocsModal;

