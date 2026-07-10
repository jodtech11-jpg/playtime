import React, { useState, useEffect, useMemo } from 'react';
import { QuickMatch } from '../../types';
import { useSports } from '../../hooks/useSports';
import { useVenues } from '../../hooks/useVenues';
import { courtMatchesSport, getSportsForVenue, findSport, cleanSportOptions } from '../../utils/sportUtils';
import { useCourts } from '../../hooks/useCourts';
import SportOptionsFields from '../shared/SportOptionsFields';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';

interface QuickMatchFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchData: Partial<QuickMatch>) => Promise<void>;
  match?: QuickMatch | null;
}

// Format a Date as YYYY-MM-DD in local time (toISOString would shift the day in non-UTC timezones)
const toLocalDateInputValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Parse a YYYY-MM-DD input value as local time (new Date('YYYY-MM-DD') parses as UTC midnight)
const parseLocalDateTime = (dateStr: string, hours: number, minutes: number): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
};

const QuickMatchFormModal: React.FC<QuickMatchFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match
}) => {
  const { venues, loading: venuesLoading } = useVenues({ realtime: false });
  const { sports: allSports, loading: sportsLoading } = useSports({ activeOnly: true, realtime: false });
  const [selectedVenueId, setSelectedVenueId] = useState<string>(match?.venueId || '');
  const { courts, loading: courtsLoading } = useCourts({ venueId: selectedVenueId, realtime: false });

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const venueSports = useMemo(
    () => getSportsForVenue(selectedVenue, allSports),
    [selectedVenue, allSports]
  );

  const [formData, setFormData] = useState({
    venueId: match?.venueId || '',
    sportId: match?.sportId || '',
    courtId: match?.courtId || '',
    date: match?.date ? toLocalDateInputValue(match.date.toDate()) : '',
    time: match?.time || '',
    maxPlayers: match?.maxPlayers || 4,
    status: match?.status || 'Open' as QuickMatch['status'],
  });
  const [sportOptions, setSportOptions] = useState<Record<string, string>>(match?.sportOptions || {});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSport = findSport(formData.sportId || match?.sport, venueSports.length ? venueSports : allSports);

  useEffect(() => {
    if (match) {
      const sportRecord = findSport(match.sportId || match.sport, allSports);
      setFormData({
        venueId: match.venueId,
        sportId: sportRecord?.id || match.sportId || '',
        courtId: match.courtId || '',
        date: match.date ? toLocalDateInputValue(match.date.toDate()) : '',
        time: match.time,
        maxPlayers: match.maxPlayers,
        status: match.status,
      });
      setSportOptions(match.sportOptions || {});
      setSelectedVenueId(match.venueId);
    } else {
      setFormData({
        venueId: '',
        sportId: '',
        courtId: '',
        date: '',
        time: '',
        maxPlayers: 4,
        status: 'Open',
      });
      setSportOptions({});
      setSelectedVenueId('');
    }
  }, [match, isOpen, allSports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.venueId || !formData.sportId || !formData.date || !formData.time) {
      setError('Please fill in all required fields');
      return;
    }

    const currentPlayers = match?.currentPlayers ?? 0;
    if (formData.maxPlayers < currentPlayers) {
      setError(`Max players cannot be less than the current player count (${currentPlayers})`);
      return;
    }

    // Keep Open/Full status consistent with the player count
    let status = formData.status;
    if (currentPlayers >= formData.maxPlayers && status === 'Open') {
      status = 'Full';
    } else if (currentPlayers < formData.maxPlayers && status === 'Full') {
      status = 'Open';
    }

    try {
      setSaving(true);

      const venue = venues.find(v => v.id === formData.venueId);
      const sport = findSport(formData.sportId, allSports);
      const selectedCourt = courts.find(c => c.id === formData.courtId);

      const [hours, minutes] = formData.time.split(':').map(Number);
      const matchDate = parseLocalDateTime(formData.date, hours, minutes);

      const matchData: Partial<QuickMatch> = {
        venueId: formData.venueId,
        venueName: venue?.name,
        sport: sport?.name || formData.sportId,
        sportId: sport?.id || '',
        // Empty object (not undefined) so edits clear stale options in Firestore
        sportOptions: cleanSportOptions(sportOptions) ?? {},
        courtId: formData.courtId || undefined,
        courtName: selectedCourt?.name,
        date: Timestamp.fromDate(matchDate),
        time: formData.time,
        maxPlayers: formData.maxPlayers,
        status,
        currentPlayers: match?.currentPlayers || 0,
        playerIds: match?.playerIds || [],
        updatedAt: serverTimestamp(),
      };

      if (!match) {
        matchData.createdBy = '';
        matchData.createdAt = serverTimestamp();
      }

      await onSave(matchData);
      onClose();
    } catch (err: any) {
      console.error('Error saving quick match:', err);
      setError(getFirebaseErrorMessage(err) || 'Failed to save quick match');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Venue-scoped list, but keep the currently selected sport visible when
  // editing a legacy match whose sport is no longer assigned to the venue.
  const baseSportList = selectedVenueId ? venueSports : allSports;
  const sportList =
    selectedSport && !baseSportList.some((s) => s.id === selectedSport.id)
      ? [selectedSport, ...baseSportList]
      : baseSportList;

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

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Venue *
            </label>
            <select
              value={formData.venueId}
              onChange={(e) => {
                setFormData({ ...formData, venueId: e.target.value, sportId: '', courtId: '' });
                setSelectedVenueId(e.target.value);
                setSportOptions({});
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

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Sport *
            </label>
            <select
              value={formData.sportId}
              onChange={(e) => {
                const sport = findSport(e.target.value, allSports);
                setFormData({
                  ...formData,
                  sportId: e.target.value,
                  courtId: '',
                  maxPlayers: sport?.defaultMaxTeamSize || formData.maxPlayers,
                });
                setSportOptions({});
              }}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
              disabled={sportsLoading || !selectedVenueId}
            >
              <option value="">
                {!selectedVenueId
                  ? 'Select a venue first'
                  : sportsLoading
                    ? 'Loading sports...'
                    : sportList.length === 0
                      ? 'No sports at this venue'
                      : 'Select Sport'}
              </option>
              {sportList.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSport && (
            <SportOptionsFields
              sport={selectedSport}
              values={sportOptions}
              onChange={setSportOptions}
              compact
            />
          )}

          {selectedVenueId && formData.sportId && (
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
                  .filter((court) => courtMatchesSport(court.sport, formData.sportId, allSports))
                  .map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

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
              min={toLocalDateInputValue(new Date())}
            />
          </div>

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
