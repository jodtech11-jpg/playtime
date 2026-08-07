import React, { useState, useEffect, useMemo } from 'react';
import { Court, TimeSlotRange } from '../../types';
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
      'Monday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
      'Tuesday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
      'Wednesday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
      'Thursday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
      'Friday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
      'Saturday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
      'Sunday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] }
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
          'Monday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Tuesday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Wednesday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Thursday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Friday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Saturday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Sunday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] }
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
          'Monday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Tuesday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Wednesday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Thursday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Friday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Saturday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] },
          'Sunday': { start: '08:00', end: '22:00', available: true, slots: [{ start: '08:00', end: '22:00' }] }
        },
        status: 'Active'
      });
    }
  }, [court, venueId, isOpen, availableSports]);

  const handleInputChange = (field: keyof Court, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getDaySlots = (day: string): TimeSlotRange[] => {
    const dayData = formData.availability?.[day];
    if (dayData?.slots && dayData.slots.length > 0) {
      return dayData.slots;
    }
    return [{ start: dayData?.start || '08:00', end: dayData?.end || '22:00' }];
  };

  const updateDaySlots = (day: string, available: boolean, newSlots: TimeSlotRange[]) => {
    const sorted = [...newSlots].sort((a, b) => a.start.localeCompare(b.start));
    const earliestStart = sorted[0]?.start || '08:00';
    const latestEnd = sorted[sorted.length - 1]?.end || '22:00';

    setFormData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          available,
          start: earliestStart,
          end: latestEnd,
          slots: sorted,
        },
      },
    }));
  };

  const handleToggleDayAvailable = (day: string, available: boolean) => {
    const currentSlots = getDaySlots(day);
    updateDaySlots(day, available, currentSlots);
  };

  const handleSlotTimeChange = (
    day: string,
    slotIndex: number,
    field: 'start' | 'end',
    val: string
  ) => {
    const slots = getDaySlots(day);
    const updated = slots.map((s, idx) => (idx === slotIndex ? { ...s, [field]: val } : s));
    updateDaySlots(day, true, updated);
  };

  const handleAddSlot = (day: string) => {
    const currentSlots = getDaySlots(day);
    const lastSlot = currentSlots[currentSlots.length - 1];
    let defaultStart = '16:00';
    let defaultEnd = '22:00';
    if (lastSlot) {
      defaultStart = lastSlot.end;
      defaultEnd = '22:00';
    }
    const updated = [...currentSlots, { start: defaultStart, end: defaultEnd }];
    updateDaySlots(day, true, updated);
  };

  const handleRemoveSlot = (day: string, slotIndex: number) => {
    const currentSlots = getDaySlots(day);
    if (currentSlots.length <= 1) return;
    const updated = currentSlots.filter((_, idx) => idx !== slotIndex);
    updateDaySlots(day, true, updated);
  };

  const handleSetAllDays = (start: string, end: string, available: boolean) => {
    const newAvailability: any = {};
    daysOfWeek.forEach((day) => {
      newAvailability[day] = {
        start,
        end,
        available,
        slots: available ? [{ start, end }] : [],
      };
    });
    setFormData((prev) => ({
      ...prev,
      availability: newAvailability,
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
              {daysOfWeek.map((day) => {
                const isAvailable = formData.availability?.[day]?.available ?? true;
                const slots = getDaySlots(day);

                return (
                  <div key={day} className="p-3 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAvailable}
                          onChange={(e) => handleToggleDayAvailable(day, e.target.checked)}
                          className="rounded text-primary focus:ring-primary size-4"
                        />
                        <span className="text-sm font-bold text-gray-800">{day}</span>
                      </label>
                      {isAvailable && (
                        <button
                          type="button"
                          onClick={() => handleAddSlot(day)}
                          className="text-xs px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-bold flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          Add Shift
                        </button>
                      )}
                    </div>

                    {isAvailable && (
                      <div className="pl-6 space-y-2">
                        {slots.map((slot, slotIndex) => (
                          <div key={slotIndex} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 w-12">Shift {slotIndex + 1}:</span>
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => handleSlotTimeChange(day, slotIndex, 'start', e.target.value)}
                              className="px-3 py-1 border border-gray-200 rounded-lg text-sm"
                            />
                            <span className="text-gray-400 text-xs font-bold">to</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => handleSlotTimeChange(day, slotIndex, 'end', e.target.value)}
                              className="px-3 py-1 border border-gray-200 rounded-lg text-sm"
                            />
                            {slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(day, slotIndex)}
                                className="size-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Remove shift"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
