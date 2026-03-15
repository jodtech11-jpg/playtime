import React, { useState, useEffect } from 'react';
import { QuickMatch } from '../../types';
import { useVenues } from '../../hooks/useVenues';
import { useCourts } from '../../hooks/useCourts';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

interface QuickMatchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchData: Partial<QuickMatch>) => Promise<void>;
  match?: QuickMatch | null;
}

const QuickMatchFormModal: React.FC<QuickMatchFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match
}) => {
  const { venues, loading: venuesLoading } = useVenues({ realtime: false });
  const [selectedVenueId, setSelectedVenueId] = useState<string>(match?.venueId || '');
  const { courts, loading: courtsLoading } = useCourts({ venueId: selectedVenueId, realtime: false });

  const [formData, setFormData] = useState({
    venueId: match?.venueId || '',
    sport: match?.sport || '',
    courtId: match?.courtId || '',
    date: match?.date ? new Date(match.date.toDate()).toISOString().split('T')[0] : '',
    time: match?.time || '',
    maxPlayers: match?.maxPlayers || 4,
    status: match?.status || 'Open' as QuickMatch['status'],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (match) {
      setFormData({
        venueId: match.venueId,
        sport: match.sport,
        courtId: match.courtId || '',
        date: match.date ? new Date(match.date.toDate()).toISOString().split('T')[0] : '',
        time: match.time,
        maxPlayers: match.maxPlayers,
        status: match.status,
      });
      setSelectedVenueId(match.venueId);
    } else {
      setFormData({
        venueId: '',
        sport: '',
        courtId: '',
        date: '',
        time: '',
        maxPlayers: 4,
        status: 'Open',
      });
      setSelectedVenueId('');
    }
  }, [match, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.venueId || !formData.sport || !formData.date || !formData.time) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      const selectedVenue = venues.find(v => v.id === formData.venueId);
      const selectedCourt = courts.find(c => c.id === formData.courtId);

      // Combine date and time into a Firestore timestamp
      const [hours, minutes] = formData.time.split(':').map(Number);
      const matchDate = new Date(formData.date);
      matchDate.setHours(hours, minutes, 0, 0);

      const matchData: Partial<QuickMatch> = {
        venueId: formData.venueId,
        venueName: selectedVenue?.name,
        sport: formData.sport,
        courtId: formData.courtId || undefined,
        courtName: selectedCourt?.name,
        date: Timestamp.fromDate(matchDate),
        time: formData.time,
        maxPlayers: formData.maxPlayers,
        status: formData.status,
        currentPlayers: match?.currentPlayers || 0,
        playerIds: match?.playerIds || [],
        updatedAt: serverTimestamp(),
      };

      // If creating new, set createdBy and createdAt
      if (!match) {
        matchData.createdBy = ''; // Will be set from auth context
        matchData.createdAt = serverTimestamp();
      }

      await onSave(matchData);
      onClose();
    } catch (err: any) {
      console.error('Error saving quick match:', err);
      setError(err.message || 'Failed to save quick match');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const sports = ['Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            {match ? 'Edit Quick Match' : 'Create Quick Match'}
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

          {/* Venue Selection */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Venue *
            </label>
            <select
              value={formData.venueId}
              onChange={(e) => {
                setFormData({ ...formData, venueId: e.target.value, courtId: '' });
                setSelectedVenueId(e.target.value);
              }}
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

          {/* Court Selection (Optional) */}
          {selectedVenueId && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Court (Optional)
              </label>
              <select
                value={formData.courtId}
                onChange={(e) => setFormData({ ...formData, courtId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={courtsLoading}
              >
                <option value="">No specific court</option>
                {courts
                  .filter(court => court.sport === formData.sport)
                  .map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Time *
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Max Players */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Max Players *
            </label>
            <input
              type="number"
              min="2"
              max="20"
              value={formData.maxPlayers}
              onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) || 4 })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as QuickMatch['status'] })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="Open">Open</option>
              <option value="Full">Full</option>
              <option value="Started">Started</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

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
              {saving ? 'Saving...' : match ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickMatchFormModal;

