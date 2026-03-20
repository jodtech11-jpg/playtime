import React, { useState, useEffect } from 'react';
import { Tournament } from '../../types';
import { tournamentsCollection } from '../../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useVenues } from '../../hooks/useVenues';
import { useSports } from '../../hooks/useSports';

interface TournamentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament?: Tournament | null;
  onSuccess?: () => void;
}

const TournamentFormModal: React.FC<TournamentFormModalProps> = ({
  isOpen,
  onClose,
  tournament,
  onSuccess
}) => {
  const { venues } = useVenues({ realtime: true });
  const { sports } = useSports({ activeOnly: true, realtime: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sport: 'Badminton',
    venueId: '',
    startDate: '',
    endDate: '',
    registrationStartDate: '',
    registrationEndDate: '',
    entryFee: 0,
    prizeFirst: '',
    prizeSecond: '',
    prizeThird: '',
    prizeDescription: '',
    maxTeams: '',
    minTeamSize: '',
    maxTeamSize: '',
    status: 'Draft' as Tournament['status'],
    bracketType: 'Single Elimination' as Tournament['bracketType']
  });

  useEffect(() => {
    if (tournament) {
      const startDate = tournament.startDate?.toDate ? 
        tournament.startDate.toDate().toISOString().split('T')[0] : '';
      const endDate = tournament.endDate?.toDate ? 
        tournament.endDate.toDate().toISOString().split('T')[0] : '';
      const regStart = tournament.registrationStartDate?.toDate ? 
        tournament.registrationStartDate.toDate().toISOString().split('T')[0] : '';
      const regEnd = tournament.registrationEndDate?.toDate ? 
        tournament.registrationEndDate.toDate().toISOString().split('T')[0] : '';

      // Find sport by ID or name for backward compatibility
      const sportId = tournament.sportId || sports.find(s => s.name === tournament.sport || s.id === tournament.sport)?.id || '';

      setFormData({
        name: tournament.name || '',
        description: tournament.description || '',
        sport: sportId,
        venueId: tournament.venueId || '',
        startDate,
        endDate,
        registrationStartDate: regStart,
        registrationEndDate: regEnd,
        entryFee: tournament.entryFee || 0,
        prizeFirst: tournament.prizeDetails?.first?.toString() || '',
        prizeSecond: tournament.prizeDetails?.second?.toString() || '',
        prizeThird: tournament.prizeDetails?.third?.toString() || '',
        prizeDescription: tournament.prizeDetails?.description || '',
        maxTeams: tournament.maxTeams?.toString() || '',
        minTeamSize: tournament.minTeamSize?.toString() || '',
        maxTeamSize: tournament.maxTeamSize?.toString() || '',
        status: tournament.status || 'Draft',
        bracketType: tournament.bracketType || 'Single Elimination'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        sport: '',
        venueId: '',
        startDate: '',
        endDate: '',
        registrationStartDate: '',
        registrationEndDate: '',
        entryFee: 0,
        prizeFirst: '',
        prizeSecond: '',
        prizeThird: '',
        prizeDescription: '',
        maxTeams: '',
        minTeamSize: '',
        maxTeamSize: '',
        status: 'Draft',
        bracketType: 'Single Elimination'
      });
    }
  }, [tournament, isOpen, sports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.venueId || !formData.startDate || !formData.endDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const prizeDetails: any = {};
      if (formData.prizeFirst) prizeDetails.first = parseFloat(formData.prizeFirst);
      if (formData.prizeSecond) prizeDetails.second = parseFloat(formData.prizeSecond);
      if (formData.prizeThird) prizeDetails.third = parseFloat(formData.prizeThird);
      if (formData.prizeDescription) prizeDetails.description = formData.prizeDescription;

      const selectedSport = sports.find(s => s.id === formData.sport);
      
      const tournamentData: any = {
        name: formData.name,
        description: formData.description,
        sport: selectedSport?.name || formData.sport, // Keep name for backward compatibility
        sportId: formData.sport, // Store sport ID
        venueId: formData.venueId,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        registrationStartDate: new Date(formData.registrationStartDate),
        registrationEndDate: new Date(formData.registrationEndDate),
        entryFee: parseFloat(formData.entryFee.toString()),
        status: formData.status,
        bracketType: formData.bracketType,
        updatedAt: serverTimestamp()
      };

      if (Object.keys(prizeDetails).length > 0) {
        tournamentData.prizeDetails = prizeDetails;
      }

      if (formData.maxTeams) tournamentData.maxTeams = parseInt(formData.maxTeams);
      if (formData.minTeamSize) tournamentData.minTeamSize = parseInt(formData.minTeamSize);
      if (formData.maxTeamSize) tournamentData.maxTeamSize = parseInt(formData.maxTeamSize);

      if (tournament) {
        await tournamentsCollection.update(tournament.id, tournamentData);
      } else {
        tournamentData.createdAt = serverTimestamp();
        await tournamentsCollection.create(tournamentData);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error saving tournament:', err);
      setError(err.message || 'Failed to save tournament');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary";
  const labelClass = "block text-sm font-black text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-widest";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-surface-dark rounded-2xl p-4 sm:p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {tournament ? 'Edit Tournament' : 'Create Tournament'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>
                Tournament Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                Sport *
              </label>
              <select
                value={formData.sport}
                onChange={(e) => {
                  const selectedSport = sports.find(s => s.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    sport: e.target.value,
                    // Auto-fill defaults from sport
                    minTeamSize: selectedSport?.defaultMinTeamSize?.toString() || formData.minTeamSize,
                    maxTeamSize: selectedSport?.defaultMaxTeamSize?.toString() || formData.maxTeamSize
                  });
                }}
                className={inputClass}
                required
                disabled={sports.length === 0}
              >
                <option value="">{sports.length === 0 ? 'No sports available' : 'Select Sport'}</option>
                {sports.map(sport => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
              {sports.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No sports found. Please create sports in Tournaments settings.
                </p>
              )}
              {formData.sport && sports.find(s => s.id === formData.sport) && (() => {
                const selectedSport = sports.find(s => s.id === formData.sport);
                return (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs space-y-1 text-gray-700 dark:text-gray-300">
                    {selectedSport?.defaultMinTeamSize && (
                      <p><strong>Default Min Team Size:</strong> {selectedSport.defaultMinTeamSize}</p>
                    )}
                    {selectedSport?.defaultMaxTeamSize && (
                      <p><strong>Default Max Team Size:</strong> {selectedSport.defaultMaxTeamSize}</p>
                    )}
                    {selectedSport?.defaultMatchDuration && (
                      <p><strong>Default Match Duration:</strong> {selectedSport.defaultMatchDuration} minutes</p>
                    )}
                    {selectedSport?.defaultScoringFormat && (
                      <p><strong>Scoring Format:</strong> {selectedSport.defaultScoringFormat}</p>
                    )}
                    {selectedSport?.sportSpecificOptions && Object.keys(selectedSport.sportSpecificOptions).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="font-bold mb-1">Sport-Specific Options:</p>
                        {Object.entries(selectedSport.sportSpecificOptions).map(([key, value]) => (
                          <p key={key} className="text-xs">
                            <strong>{key}:</strong> {Array.isArray(value) ? value.join(', ') : String(value)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <label className={labelClass}>
                Venue *
              </label>
              <select
                value={formData.venueId}
                onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
                className={inputClass}
                required
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
              <label className={labelClass}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Tournament['status'] })}
                className={inputClass}
              >
                <option value="Draft">Draft</option>
                <option value="Open">Open</option>
                <option value="Registration Closed">Registration Closed</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                Registration Start *
              </label>
              <input
                type="date"
                value={formData.registrationStartDate}
                onChange={(e) => setFormData({ ...formData, registrationStartDate: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                Registration End *
              </label>
              <input
                type="date"
                value={formData.registrationEndDate}
                onChange={(e) => setFormData({ ...formData, registrationEndDate: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                Entry Fee (₹)
              </label>
              <input
                type="number"
                value={formData.entryFee}
                onChange={(e) => setFormData({ ...formData, entryFee: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className={labelClass}>
                Bracket Type
              </label>
              <select
                value={formData.bracketType}
                onChange={(e) => setFormData({ ...formData, bracketType: e.target.value as Tournament['bracketType'] })}
                className={inputClass}
              >
                <option value="Single Elimination">Single Elimination</option>
                <option value="Double Elimination">Double Elimination</option>
                <option value="Round Robin">Round Robin</option>
                <option value="Swiss">Swiss</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Max Teams
              </label>
              <input
                type="number"
                value={formData.maxTeams}
                onChange={(e) => setFormData({ ...formData, maxTeams: e.target.value })}
                className={inputClass}
                min="2"
              />
            </div>

            <div>
              <label className={labelClass}>
                Min Team Size
              </label>
              <input
                type="number"
                value={formData.minTeamSize}
                onChange={(e) => setFormData({ ...formData, minTeamSize: e.target.value })}
                className={inputClass}
                min="1"
              />
            </div>

            <div>
              <label className={labelClass}>
                Max Team Size
              </label>
              <input
                type="number"
                value={formData.maxTeamSize}
                onChange={(e) => setFormData({ ...formData, maxTeamSize: e.target.value })}
                className={inputClass}
                min="1"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputClass}
              rows={3}
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-4">Prize Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>
                  First Prize (₹)
                </label>
                <input
                  type="number"
                  value={formData.prizeFirst}
                  onChange={(e) => setFormData({ ...formData, prizeFirst: e.target.value })}
                  className={inputClass}
                  min="0"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Second Prize (₹)
                </label>
                <input
                  type="number"
                  value={formData.prizeSecond}
                  onChange={(e) => setFormData({ ...formData, prizeSecond: e.target.value })}
                  className={inputClass}
                  min="0"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Third Prize (₹)
                </label>
                <input
                  type="number"
                  value={formData.prizeThird}
                  onChange={(e) => setFormData({ ...formData, prizeThird: e.target.value })}
                  className={inputClass}
                  min="0"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>
                Prize Description
              </label>
              <textarea
                value={formData.prizeDescription}
                onChange={(e) => setFormData({ ...formData, prizeDescription: e.target.value })}
                className={inputClass}
                rows={2}
                placeholder="Additional prize information..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-black uppercase tracking-widest text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-primary-content rounded-xl hover:shadow-lg transition-all font-black uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? 'Saving...' : tournament ? 'Update Tournament' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TournamentFormModal;

