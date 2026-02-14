import React, { useState, useEffect } from 'react';
import { MembershipPlan } from '../types';
import { useVenues } from '../hooks/useVenues';

interface MembershipPlanFormModalProps {
  plan: MembershipPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (planData: Partial<MembershipPlan>) => Promise<void>;
}

const MembershipPlanFormModal: React.FC<MembershipPlanFormModalProps> = ({
  plan,
  isOpen,
  onClose,
  onSave
}) => {
  const { venues } = useVenues();
  const [formData, setFormData] = useState<Partial<MembershipPlan>>({
    name: '',
    venueId: '',
    type: 'Monthly',
    price: 0,
    features: [],
    isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        venueId: plan.venueId || '',
        type: plan.type || 'Monthly',
        price: plan.price || 0,
        features: plan.features || [],
        isActive: plan.isActive !== undefined ? plan.isActive : true
      });
    } else {
      setFormData({
        name: '',
        venueId: venues.length > 0 ? venues[0].id : '',
        type: 'Monthly',
        price: 0,
        features: [],
        isActive: true
      });
    }
  }, [plan, isOpen, venues]);

  const handleInputChange = (field: keyof MembershipPlan, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...(prev.features || []), newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    const features = formData.features || [];
    setFormData(prev => ({
      ...prev,
      features: features.filter((_, i) => i !== index)
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
      console.error('Error saving membership plan:', err);
      setError(err.message || 'Failed to save membership plan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-black text-gray-900">
            {plan ? 'Edit Membership Plan' : 'Create New Membership Plan'}
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
              <label className="block text-sm font-black text-gray-700 mb-2">Plan Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
                placeholder="e.g., Rookie Pass"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Venue *</label>
              <select
                value={formData.venueId}
                onChange={(e) => handleInputChange('venueId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="">Select Venue</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Plan Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="Monthly">Monthly</option>
                <option value="6 Months">6 Months</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Features</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFeature();
                  }
                }}
                placeholder="Add feature (e.g., 2 bookings/week)"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddFeature}
                className="px-4 py-2 bg-primary text-primary-content rounded-xl font-bold hover:bg-primary-hover transition-all"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {formData.features?.map((feature, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                    <span className="text-sm font-semibold text-gray-700">{feature}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFeature(index)}
                    className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-red-500 text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              className="h-5 w-5 rounded-lg border-gray-200 text-primary focus:ring-primary"
            />
            <label htmlFor="isActive" className="text-sm font-bold text-gray-700 cursor-pointer">
              Plan is active and visible to users
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-content py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
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

export default MembershipPlanFormModal;

