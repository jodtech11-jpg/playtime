import React, { useState, useEffect, useMemo } from 'react';
import { Leaderboard } from '../../types';
import { useVenues } from '../../hooks/useVenues';
import { useSports } from '../../hooks/useSports';
import { useAuth } from '../../contexts/AuthContext';
import { getSportsForVenue } from '../../utils/sportUtils';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';
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
  const { isSuperAdmin, isVenueManager } = useAuth();
  const { venues, loading: venuesLoading } = useVenues({ realtime: false });
  const { sports: allSports, loading: sportsLoading } = useSports({ activeOnly: true, realtime: false });

  // Vendors can only create venue-scoped leaderboards (Global/Monthly/All-Time are platform-wide).
  const types: Leaderboard['type'][] = isSuperAdmin
    ? ['Global', 'Venue', 'Monthly', 'All-Time']
    : ['Venue'];

  const defaultType: Leaderboard['type'] = isSuperAdmin ? 'Global' : 'Venue';

  const [formData, setFormData] = useState({
    venueId: leaderboard?.venueId || '',
    sport: leaderboard?.sport || '',
    type: leaderboard?.type || defaultType,
    period: leaderboard?.period || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresVenue = formData.type === 'Venue' || isVenueManager;

  const selectedVenue = venues.find((v) => v.id === formData.venueId);
  const availableSports = useMemo(() => {
    if (requiresVenue && selectedVenue) {
      return getSportsForVenue(selectedVenue, allSports);
    }
    return allSports;
  }, [requiresVenue, selectedVenue, allSports]);

  useEffect(() => {
    if (leaderboard) {
      setFormData({
        venueId: leaderboard.venueId || '',
        sport: leaderboard.sport,
        type: leaderboard.type,
        period: leaderboard.period || '',
      });
    } else {
      const autoVenue = !isSuperAdmin && venues.length === 1 ? venues[0].id : '';
      setFormData({
        venueId: autoVenue,
        sport: '',
        type: defaultType,
        period: '',
      });
    }
  }, [leaderboard, isOpen, isSuperAdmin, venues, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.sport) {
      setError('Please select a sport');
      return;
    }

    if (!isSuperAdmin && formData.type !== 'Venue') {
      setError('Vendors can only create Venue leaderboards. Global types are managed by Super Admin.');
      return;
    }

    if (requiresVenue && !formData.venueId) {
      setError('Please select a venue for this leaderboard');
      return;
    }

    if (formData.type === 'Monthly' && !formData.period.trim()) {
      setError('Please enter a period (e.g. "January 2026")');
      return;
    }

    try {
      setSaving(true);

      const venue = venues.find(v => v.id === formData.venueId);

      const leaderboardData: Partial<Leaderboard> = {
        venueId: formData.venueId || undefined,
        venueName: venue?.name,
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
      setError(getFirebaseErrorMessage(err) || 'Failed to save leaderboard');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            {leaderboard ? 'Edit Leaderboard' : 'Create Leaderboard'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
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

          {!isSuperAdmin && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Venue managers create leaderboards for their assigned venues. Platform-wide (Global) leaderboards are managed by super admins.
            </p>
          )}

          {/* Type */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => {
                const nextType = e.target.value as Leaderboard['type'];
                setFormData((prev) => ({
                  ...prev,
                  type: nextType,
                  // Keep venue for vendors; clear only when super admin switches away from Venue
                  venueId: nextType === 'Venue' || isVenueManager ? prev.venueId : '',
                  sport: '',
                }));
              }}
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

          {/* Venue — required for Venue type and for all vendor creates */}
          {requiresVenue && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Venue *
              </label>
              <select
                value={formData.venueId}
                onChange={(e) => setFormData({ ...formData, venueId: e.target.value, sport: '' })}
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
              disabled={sportsLoading || (requiresVenue && !formData.venueId)}
            >
              <option value="">
                {sportsLoading
                  ? 'Loading sports...'
                  : requiresVenue && !formData.venueId
                    ? 'Select a venue first'
                    : 'Select Sport'}
              </option>
              {availableSports.map((sport) => (
                <option key={sport.id} value={sport.name}>
                  {sport.name}
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
              className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-black text-sm uppercase tracking-wider"
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
