import React, { useState, useEffect } from 'react';
import { FlashDeal } from '../types';
import { useVenues } from '../hooks/useVenues';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import ImageUpload from './ImageUpload';

interface FlashDealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dealData: Partial<FlashDeal>) => Promise<void>;
  deal?: FlashDeal | null;
}

const FlashDealFormModal: React.FC<FlashDealFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  deal
}) => {
  const { venues, loading: venuesLoading } = useVenues({ realtime: false });

  const [formData, setFormData] = useState({
    title: deal?.title || '',
    description: deal?.description || '',
    venueId: deal?.venueId || '',
    discountType: deal?.discountType || 'Percentage' as FlashDeal['discountType'],
    discountValue: deal?.discountValue || 0,
    originalPrice: deal?.originalPrice || 0,
    startTime: deal?.startTime ? new Date(deal.startTime.toDate()).toISOString().slice(0, 16) : '',
    endTime: deal?.endTime ? new Date(deal.endTime.toDate()).toISOString().slice(0, 16) : '',
    maxBookings: deal?.maxBookings || 0,
    imageUrl: deal?.imageUrl || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        description: deal.description || '',
        venueId: deal.venueId,
        discountType: deal.discountType,
        discountValue: deal.discountValue,
        originalPrice: deal.originalPrice,
        startTime: deal.startTime ? new Date(deal.startTime.toDate()).toISOString().slice(0, 16) : '',
        endTime: deal.endTime ? new Date(deal.endTime.toDate()).toISOString().slice(0, 16) : '',
        maxBookings: deal.maxBookings || 0,
        imageUrl: deal.imageUrl || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        venueId: '',
        discountType: 'Percentage',
        discountValue: 0,
        originalPrice: 0,
        startTime: '',
        endTime: '',
        maxBookings: 0,
        imageUrl: '',
      });
    }
  }, [deal, isOpen]);

  // Calculate discounted price when discount changes
  useEffect(() => {
    if (formData.originalPrice > 0 && formData.discountValue > 0) {
      let discountedPrice = formData.originalPrice;
      if (formData.discountType === 'Percentage') {
        discountedPrice = formData.originalPrice * (1 - formData.discountValue / 100);
      } else {
        discountedPrice = formData.originalPrice - formData.discountValue;
      }
      // This will be calculated in handleSubmit
    }
  }, [formData.originalPrice, formData.discountType, formData.discountValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.venueId || !formData.startTime || !formData.endTime) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.originalPrice <= 0) {
      setError('Original price must be greater than 0');
      return;
    }

    if (formData.discountValue <= 0) {
      setError('Discount value must be greater than 0');
      return;
    }

    if (formData.discountType === 'Percentage' && formData.discountValue > 100) {
      setError('Discount percentage cannot exceed 100%');
      return;
    }

    if (formData.discountType === 'Fixed' && formData.discountValue >= formData.originalPrice) {
      setError('Fixed discount cannot be greater than or equal to original price');
      return;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);

    if (endTime <= startTime) {
      setError('End time must be after start time');
      return;
    }

    try {
      setSaving(true);

      const selectedVenue = venues.find(v => v.id === formData.venueId);

      // Calculate discounted price
      let discountedPrice = formData.originalPrice;
      if (formData.discountType === 'Percentage') {
        discountedPrice = formData.originalPrice * (1 - formData.discountValue / 100);
      } else {
        discountedPrice = formData.originalPrice - formData.discountValue;
      }

      // Determine status based on current time
      const now = new Date();
      let status: FlashDeal['status'] = 'Upcoming';
      if (now >= startTime && now <= endTime) {
        status = 'Active';
      } else if (now > endTime) {
        status = 'Expired';
      }

      const dealData: Partial<FlashDeal> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        venueId: formData.venueId,
        venueName: selectedVenue?.name,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        originalPrice: formData.originalPrice,
        discountedPrice: Math.max(0, discountedPrice),
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        maxBookings: formData.maxBookings > 0 ? formData.maxBookings : undefined,
        currentBookings: deal?.currentBookings || 0,
        status,
        imageUrl: formData.imageUrl || undefined,
        updatedAt: serverTimestamp(),
      };

      if (!deal) {
        dealData.createdAt = serverTimestamp();
      }

      await onSave(dealData);
      onClose();
    } catch (err: any) {
      console.error('Error saving flash deal:', err);
      setError(err.message || 'Failed to save flash deal');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const calculatedDiscount = formData.originalPrice > 0 && formData.discountValue > 0
    ? formData.discountType === 'Percentage'
      ? formData.originalPrice * (1 - formData.discountValue / 100)
      : formData.originalPrice - formData.discountValue
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-dark rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">
            {deal ? 'Edit Flash Deal' : 'Create Flash Deal'}
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

          {/* Title */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
          </div>

          {/* Venue Selection */}
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

          {/* Image Upload */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Image
            </label>
            <ImageUpload
              value={formData.imageUrl ? [formData.imageUrl] : []}
              onChange={(urls) => setFormData({ ...formData, imageUrl: urls[0] || '' })}
              folder="flash-deals"
              maxImages={1}
            />
          </div>

          {/* Original Price */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Original Price (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.originalPrice}
              onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Discount Type */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Discount Type *
            </label>
            <select
              value={formData.discountType}
              onChange={(e) => setFormData({ ...formData, discountType: e.target.value as FlashDeal['discountType'] })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="Percentage">Percentage (%)</option>
              <option value="Fixed">Fixed Amount (₹)</option>
            </select>
          </div>

          {/* Discount Value */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Discount Value * {formData.discountType === 'Percentage' ? '(%)' : '(₹)'}
            </label>
            <input
              type="number"
              min="0"
              max={formData.discountType === 'Percentage' ? 100 : formData.originalPrice}
              step={formData.discountType === 'Percentage' ? '1' : '0.01'}
              value={formData.discountValue}
              onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Calculated Discounted Price */}
          {calculatedDiscount > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Discounted Price:</span>
                <span className="text-primary font-black text-lg">₹{calculatedDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400 text-sm">You Save:</span>
                <span className="text-green-400 font-black">₹{(formData.originalPrice - calculatedDiscount).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Max Bookings */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Max Bookings (0 = Unlimited)
            </label>
            <input
              type="number"
              min="0"
              value={formData.maxBookings}
              onChange={(e) => setFormData({ ...formData, maxBookings: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Start Time *
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* End Time */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              End Time *
            </label>
            <input
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
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
              {saving ? 'Saving...' : deal ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlashDealFormModal;

