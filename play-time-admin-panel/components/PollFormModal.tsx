import React, { useState, useEffect } from 'react';
import { Poll } from '../types';
import { useVenues } from '../hooks/useVenues';
import { serverTimestamp } from 'firebase/firestore';

interface PollFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pollData: Partial<Poll>) => Promise<void>;
  poll?: Poll | null;
}

const PollFormModal: React.FC<PollFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  poll
}) => {
  const { venues, loading: venuesLoading } = useVenues({ realtime: false });

  const [formData, setFormData] = useState({
    question: poll?.question || '',
    venueId: poll?.venueId || '',
    sport: poll?.sport || '',
    status: poll?.status || 'Active' as Poll['status'],
    startDate: poll?.startDate ? new Date(poll.startDate.toDate()).toISOString().split('T')[0] : '',
    endDate: poll?.endDate ? new Date(poll.endDate.toDate()).toISOString().split('T')[0] : '',
    options: poll?.options || [{ id: '1', text: '', votes: 0 }, { id: '2', text: '', votes: 0 }],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (poll) {
      setFormData({
        question: poll.question,
        venueId: poll.venueId || '',
        sport: poll.sport || '',
        status: poll.status,
        startDate: poll.startDate ? new Date(poll.startDate.toDate()).toISOString().split('T')[0] : '',
        endDate: poll.endDate ? new Date(poll.endDate.toDate()).toISOString().split('T')[0] : '',
        options: poll.options,
      });
    } else {
      setFormData({
        question: '',
        venueId: '',
        sport: '',
        status: 'Active',
        startDate: '',
        endDate: '',
        options: [{ id: '1', text: '', votes: 0 }, { id: '2', text: '', votes: 0 }],
      });
    }
  }, [poll, isOpen]);

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { id: Date.now().toString(), text: '', votes: 0 }],
    });
  };

  const handleRemoveOption = (optionId: string) => {
    if (formData.options.length <= 2) {
      setError('Poll must have at least 2 options');
      return;
    }
    setFormData({
      ...formData,
      options: formData.options.filter(opt => opt.id !== optionId),
    });
  };

  const handleOptionChange = (optionId: string, text: string) => {
    setFormData({
      ...formData,
      options: formData.options.map(opt =>
        opt.id === optionId ? { ...opt, text } : opt
      ),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (formData.options.filter(opt => opt.text.trim()).length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    try {
      setSaving(true);

      const selectedVenue = venues.find(v => v.id === formData.venueId);

      const pollData: Partial<Poll> = {
        question: formData.question.trim(),
        venueId: formData.venueId || undefined,
        sport: formData.sport || undefined,
        status: formData.status,
        options: formData.options.filter(opt => opt.text.trim()).map(opt => ({
          id: opt.id,
          text: opt.text.trim(),
          votes: poll?.options.find(o => o.id === opt.id)?.votes || 0,
        })),
        totalVotes: poll?.totalVotes || 0,
        updatedAt: serverTimestamp(),
      };

      if (formData.startDate) {
        const startDate = new Date(formData.startDate);
        startDate.setHours(0, 0, 0, 0);
        pollData.startDate = startDate;
      }

      if (formData.endDate) {
        const endDate = new Date(formData.endDate);
        endDate.setHours(23, 59, 59, 999);
        pollData.endDate = endDate;
      }

      if (!poll) {
        pollData.createdAt = serverTimestamp();
      }

      await onSave(pollData);
      onClose();
    } catch (err: any) {
      console.error('Error saving poll:', err);
      setError(err.message || 'Failed to save poll');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const sports = ['', 'Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">
            {poll ? 'Edit Poll' : 'Create Poll'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Question */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Question *
            </label>
            <input
              type="text"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Best surface for Football?"
              required
            />
          </div>

          {/* Venue Selection (Optional) */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Venue (Optional)
            </label>
            <select
              value={formData.venueId}
              onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={venuesLoading}
            >
              <option value="">All Venues</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sport Selection (Optional) */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Sport (Optional)
            </label>
            <select
              value={formData.sport}
              onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {sports.map((sport) => (
                <option key={sport || 'all'} value={sport}>
                  {sport || 'All Sports'}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Options * (At least 2)
            </label>
            <div className="space-y-2">
              {formData.options.map((option, index) => (
                <div key={option.id} className="flex gap-2">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => handleOptionChange(option.id, e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={`Option ${index + 1}`}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(option.id)}
                      className="px-4 py-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddOption}
              className="mt-2 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm font-black uppercase tracking-wider"
            >
              + Add Option
            </button>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Start Date (Optional)
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Poll['status'] })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors font-black text-sm uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-primary text-background-dark rounded-xl hover:bg-primary/90 transition-colors font-black text-sm uppercase tracking-wider disabled:opacity-50"
            >
              {saving ? 'Saving...' : poll ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PollFormModal;

