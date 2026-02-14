import React, { useState, useEffect } from 'react';
import { Court } from '../types';
import { useSports } from '../hooks/useSports';

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
      setFormData({
        name: court.name || '',
        venueId: court.venueId || venueId,
        sport: court.sport || '',
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
  }, [court, venueId, isOpen]);

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
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Error saving court:', err);
      setError(err.message || 'Failed to save court');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Information */}
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
                <p className="text-xs text-amber-600 mt-1">
                  No sports found. Please create sports in Tournaments settings.
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
                placeholder="e.g., Indoor, Outdoor, Synthetic"
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
            <label className="block text-sm font-black text-gray-700 mb-2">Status *</label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              required
            >
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Availability Schedule */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-black text-gray-700">Availability Schedule</label>
              <button
                type="button"
                onClick={() => handleSetAllDays('08:00', '22:00', true)}
                className="text-xs font-bold text-primary hover:text-primary-hover"
              >
                Set All Days
              </button>
            </div>
            <div className="space-y-3 border border-gray-200 rounded-xl p-4">
              {daysOfWeek.map(day => {
                const dayAvailability = formData.availability?.[day] || { start: '08:00', end: '22:00', available: true };
                return (
                  <div key={day} className="flex items-center gap-4">
                    <div className="w-24">
                      <label className="text-sm font-bold text-gray-700">{day}</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dayAvailability.available}
                        onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-200 text-primary focus:ring-primary"
                      />
                      <span className="text-xs text-gray-500">Available</span>
                    </div>
                    {dayAvailability.available && (
                      <>
                        <input
                          type="time"
                          value={dayAvailability.start}
                          onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="time"
                          value={dayAvailability.end}
                          onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-content py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : court ? 'Update Court' : 'Create Court'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourtFormModal;

