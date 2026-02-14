import React, { useState, useEffect, useMemo } from 'react';
import { MarketingCampaign } from '../types';
import { useVenues } from '../hooks/useVenues';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (campaign: Omit<MarketingCampaign, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editingCampaign?: MarketingCampaign | null;
}

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  editingCampaign
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'Global' | 'Venue'>('Global');
  const [venueId, setVenueId] = useState<string>('');
  const [target, setTarget] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'Live' | 'Paused' | 'Draft' | 'Expired'>('Draft');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { venues } = useVenues({ realtime: false });

  // Populate form when editing
  useEffect(() => {
    if (editingCampaign) {
      setTitle(editingCampaign.title);
      setDescription(editingCampaign.description || '');
      setType(editingCampaign.type);
      setVenueId(editingCampaign.venueId || '');
      setTarget(editingCampaign.target);
      setImageUrl(editingCampaign.imageUrl);
      setStatus(editingCampaign.status);
      if (editingCampaign.startDate) {
        const start = editingCampaign.startDate.toDate ? editingCampaign.startDate.toDate() : new Date(editingCampaign.startDate);
        setStartDate(start.toISOString().split('T')[0]);
      }
      if (editingCampaign.endDate) {
        const end = editingCampaign.endDate.toDate ? editingCampaign.endDate.toDate() : new Date(editingCampaign.endDate);
        setEndDate(end.toISOString().split('T')[0]);
      }
    } else {
      // Reset form for new campaign
      setTitle('');
      setDescription('');
      setType('Global');
      setVenueId('');
      setTarget('');
      setImageUrl('');
      setStatus('Draft');
      setStartDate('');
      setEndDate('');
    }
    setError(null);
  }, [editingCampaign, isOpen]);

  const selectedVenue = useMemo(() => {
    return venues.find(v => v.id === venueId);
  }, [venues, venueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!title.trim()) {
        throw new Error('Campaign title is required');
      }

      if (!target.trim()) {
        throw new Error('Target placement is required');
      }

      if (!imageUrl.trim()) {
        throw new Error('Image URL is required');
      }

      if (type === 'Venue' && !venueId) {
        throw new Error('Please select a venue for venue-specific campaigns');
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          throw new Error('End date must be after start date');
        }
      }

      const campaignData: Omit<MarketingCampaign, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        venueId: type === 'Venue' ? venueId : undefined,
        venueName: selectedVenue?.name,
        target: target.trim(),
        imageUrl: imageUrl.trim(),
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        clicks: editingCampaign?.clicks || 0,
        impressions: editingCampaign?.impressions || 0
      };

      await onCreate(campaignData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-2xl font-black text-gray-900">
            {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Campaign Title */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Campaign Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Summer Cup Tournament"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Campaign description..."
              rows={3}
            />
          </div>

          {/* Campaign Type */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Campaign Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setType('Global');
                  setVenueId('');
                }}
                className={`px-4 py-3 border-2 rounded-xl font-bold text-sm transition-all ${
                  type === 'Global'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setType('Venue')}
                className={`px-4 py-3 border-2 rounded-xl font-bold text-sm transition-all ${
                  type === 'Venue'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                Venue Specific
              </button>
            </div>
          </div>

          {/* Venue Selection (if Venue type) */}
          {type === 'Venue' && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Select Venue *
              </label>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                required={type === 'Venue'}
              >
                <option value="">Select a venue...</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Target Placement */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Target Placement *
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Discovery Page, Home Screen, Booking Page"
              required
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Image URL *
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com/image.jpg"
              required
            />
            {imageUrl && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                <img
                  src={imageUrl}
                  alt="Campaign preview"
                  className="w-full h-32 object-cover rounded-xl border border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Draft">Draft</option>
              <option value="Live">Live</option>
              <option value="Paused">Paused</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : editingCampaign ? 'Update Campaign' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaignModal;

