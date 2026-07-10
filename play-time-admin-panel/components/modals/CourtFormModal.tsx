import React, { useState, useEffect, useMemo } from 'react';
import { Court } from '../../types';
import { useSports } from '../../hooks/useSports';
import { useVenues } from '../../hooks/useVenues';
import { getSportsForVenue } from '../../utils/sportUtils';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';

interface CourtFormModalProps {
  court: Court | null;
  venueId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (courtData: Partial<Court>) => Promise<void>;
}

const CourtFormModal: React.FC<CourtFormModalProps> = ({
  court,
  venueId,
  isOpen,
  onClose,
  onSave
}) => {
  const { venues } = useVenues({ realtime: false });
  const venue = venues.find((v) => v.id === venueId);
  const { sports: allSports } = useSports({ activeOnly: true, realtime: false });
  const availableSports = useMemo(() => {
    const venueScoped = getSportsForVenue(venue, allSports);
    // Keep the current court's sport selectable when editing a legacy court
    // whose sport is no longer assigned to the venue.
    const currentField = court?.sportId || court?.sport;
    if (currentField) {
      const current = allSports.find(
        (s) => s.id === currentField || s.name.toLowerCase() === currentField.toLowerCase()
      );
      if (current && !venueScoped.some((s) => s.id === current.id)) {
        return [current, ...venueScoped];
      }
    }
    return venueScoped;
  }, [venue, allSports, court?.sportId, court?.sport]);

  const [formData, setFormData] = useState<Partial<Court>>({
    name: '',
    venueId: '',
    sport: '',
    type: '',
    pricePerHour: 0,
    availability: {
      'Monday': { start: '08:00', end: '22:00', available: true },
      'Tuesday': { start: '08:00', end: '22:00', available: true },
      'Wednesday': { start: '08:00', end: '22:00', available: true },
      'Thursday': { start: '08:00', end: '22:00', available: true },
      'Friday': { start: '08:00', end: '22:00', available: true },
      'Saturday': { start: '08:00', end: '22:00', available: true },
      'Sunday': { start: '08:00', end: '22:00', available: true }
    },
    status: 'Active'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (court) {
      const sportField = court.sportId || court.sport || '';
      const matchedSport = availableSports.find(
        (s) => s.id === sportField || s.name === sportField || s.id === court.sportId
      );
      setFormData({
        name: court.name || '',
        venueId: court.venueId || venueId,
        sport: matchedSport?.id ?? sportField,
        type: court.type || '',
        pricePerHour: court.pricePerHour || 0,
        availability: court.availability || {
          'Monday': { start: '08:00', end: '22:00', available: true },
          'Tuesday': { start: '08:00', end: '22:00', available: true },
          'Wednesday': { start: '08:00', end: '22:00', available: true },
          'Thursday': { start: '08:00', end: '22:00', available: true },
          'Friday': { start: '08:00', end: '22:00', available: true },
          'Saturday': { start: '08:00', end: '22:00', available: true },
          'Sunday': { start: '08:00', end: '22:00', available: true }
        },
        status: court.status || 'Active'
      });
    } else {
      setFormData({
        name: '',
        venueId: venueId,
        sport: '',
        type: '',
        pricePerHour: 0,
        availability: {
          'Monday': { start: '08:00', end: '22:00', available: true },
          'Tuesday': { start: '08:00', end: '22:00', available: true },
          'Wednesday': { start: '08:00', end: '22:00', available: true },
          'Thursday': { start: '08:00', end: '22:00', available: true },
          'Friday': { start: '08:00', end: '22:00', available: true },
          'Saturday': { start: '08:00', end: '22:00', available: true },
          'Sunday': { start: '08:00', end: '22:00', available: true }
        },
        status: 'Active'
      });
    }
  }, [court, venueId, isOpen, availableSports]);

  const handleInputChange = (field: keyof Court, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (day: string, field: 'start' | 'end' | 'available', value: any) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability?.[day],
          [field]: value
        }
      }
    }));
  };

  const handleSetAllDays = (start: string, end: string, available: boolean) => {
    const newAvailability: any = {};
    daysOfWeek.forEach(day => {
      newAvailability[day] = { start, end, available };
    });
    setFormData(prev => ({
      ...prev,
      availability: newAvailability
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const selectedSport = availableSports.find(
        (s) => s.id === formData.sport || s.name === formData.sport
      );
      if (!selectedSport) {
        throw new Error('Please select a valid sport offered at this venue');
      }
      const payload = {
        ...formData,
        sport: selectedSport.name,
        sportId: selectedSport.id,
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Error saving court:', err);
      setError(getFirebaseErrorMessage(err) || 'Failed to save court');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-black text-gray-900">
            {court ? 'Edit Court' : 'Add New Court'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Court Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
                placeholder="e.g., Court 1, Turf A"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Sport *</label>
              <select
                value={formData.sport}
                onChange={(e) => handleInputChange('sport', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
                disabled={availableSports.length === 0}
              >
                <option value="">{availableSports.length === 0 ? 'No sports available' : 'Select Sport'}</option>
                {availableSports.map(sport => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
              {availableSports.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No sports assigned to this venue. Add disciplines in venue settings or contact your platform admin.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Court Type</label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="e.g., Indoor, Turf, Hard Court"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Price Per Hour (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.pricePerHour}
                onChange={(e) => handleInputChange('pricePerHour', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-black text-gray-700">Weekly Availability</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllDays('08:00', '22:00', true)}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"
                >
                  Set All 8AM-10PM
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllDays('08:00', '22:00', false)}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"
                >
                  Close All
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {daysOfWeek.map(day => (
                <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                  <div className="w-24">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.availability?.[day]?.available ?? true}
                        onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-bold text-gray-700">{day}</span>
                    </label>
                  </div>
                  {formData.availability?.[day]?.available && (
                    <>
                      <input
                        type="time"
                        value={formData.availability?.[day]?.start || '08:00'}
                        onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                        className="px-3 py-1 border border-gray-200 rounded-lg text-sm"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        value={formData.availability?.[day]?.end || '22:00'}
                        onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                        className="px-3 py-1 border border-gray-200 rounded-lg text-sm"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-black text-sm uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 font-black text-sm uppercase disabled:opacity-50"
            >
              {loading ? 'Saving...' : court ? 'Update Court' : 'Create Court'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourtFormModal;
