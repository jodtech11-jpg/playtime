import React, { useState, useEffect } from 'react';
import { Leaderboard } from '../types';
import { useVenues } from '../hooks/useVenues';
import { serverTimestamp } from 'firebase/firestore';

interface LeaderboardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leaderboardData: Partial<Leaderboard>) => Promise<void>;
  leaderboard?: Leaderboard | null;
}

const LeaderboardFormModal: React.FC<LeaderboardFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  leaderboard
}) => {
  const { venues, loading: venuesLoading } = useVenues({ realtime: false });

  const [formData, setFormData] = useState({
    venueId: leaderboard?.venueId || '',
    sport: leaderboard?.sport || '',
    type: leaderboard?.type || 'Global' as Leaderboard['type'],
    period: leaderboard?.period || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leaderboard) {
      setFormData({
        venueId: leaderboard.venueId || '',
        sport: leaderboard.sport,
        type: leaderboard.type,
        period: leaderboard.period || '',
      });
    } else {
      setFormData({
        venueId: '',
        sport: '',
        type: 'Global',
        period: '',
      });
    }
  }, [leaderboard, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.sport) {
      setError('Please select a sport');
      return;
    }

    try {
      setSaving(true);

      const selectedVenue = venues.find(v => v.id === formData.venueId);

      const leaderboardData: Partial<Leaderboard> = {
        venueId: formData.venueId || undefined,
        venueName: selectedVenue?.name,
        sport: formData.sport,
        type: formData.type,
        period: formData.period || undefined,
        entries: leaderboard?.entries || [],
        updatedAt: serverTimestamp(),
      };

      await onSave(leaderboardData);
      onClose();
    } catch (err: any) {
      console.error('Error saving leaderboard:', err);
      setError(err.message || 'Failed to save leaderboard');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const sports = ['Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball'];
  const types: Leaderboard['type'][] = ['Global', 'Venue', 'Monthly', 'All-Time'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">
            {leaderboard ? 'Edit Leaderboard' : 'Create Leaderboard'}
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

          {/* Type */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Leaderboard['type'] })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Venue Selection (if type is Venue) */}
          {formData.type === 'Venue' && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Venue *
              </label>
              <select
                value={formData.venueId}
                onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={venuesLoading}
              >
                <option value="">Select Venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sport Selection */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Sport *
            </label>
            <select
              value={formData.sport}
              onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Select Sport</option>
              {sports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </div>

          {/* Period (if type is Monthly) */}
          {formData.type === 'Monthly' && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Period (e.g., "January 2024")
              </label>
              <input
                type="text"
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                placeholder="January 2024"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

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
              {saving ? 'Saving...' : leaderboard ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaderboardFormModal;

