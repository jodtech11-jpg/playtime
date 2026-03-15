import React, { useState, useEffect } from 'react';
import { Staff } from '../../types';
import { useVenues } from '../../hooks/useVenues';

interface StaffFormModalProps {
  staff: Staff | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (staffData: Partial<Staff>) => Promise<void>;
}

const StaffFormModal: React.FC<StaffFormModalProps> = ({
  staff,
  isOpen,
  onClose,
  onSave
}) => {
  const { venues } = useVenues({ realtime: true });
  const [formData, setFormData] = useState<Partial<Staff>>({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    salary: 0,
    status: 'Active',
    venueId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const validatePhone = (value: string): string | null => {
    const trimmed = (value || '').trim();
    if (!trimmed) return null; // optional field
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return 'Phone must have 10–15 digits';
    // Indian: 10 digits (6–9) or 12 digits (91 + 10)
    if (digits.startsWith('91') && digits.length === 12) {
      return /^91[6-9]\d{9}$/.test(digits) ? null : 'Invalid Indian number (e.g. +91 9876543210)';
    }
    if (digits.length === 10) {
      return /^[6-9]\d{9}$/.test(digits) ? null : 'Indian mobile must start with 6, 7, 8 or 9';
    }
    return null; // other international formats
  };

  useEffect(() => {
    setPhoneError(null);
    if (staff) {
      setFormData({
        name: staff.name || '',
        email: staff.email || '',
        phone: staff.phone || '',
        role: staff.role || '',
        department: staff.department || '',
        salary: staff.salary || 0,
        status: staff.status || 'Active',
        venueId: staff.venueId || ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: '',
        department: '',
        salary: 0,
        status: 'Active',
        venueId: venues.length > 0 ? venues[0].id : ''
      });
    }
  }, [staff, venues, isOpen]);

  const handleInputChange = (field: keyof Staff, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'phone') {
      setPhoneError(validatePhone(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phoneErr = validatePhone(formData.phone || '');
    setPhoneError(phoneErr);
    if (phoneErr) return;

    setLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Error saving staff:', err);
      setError(err.message || 'Failed to save staff');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            {staff ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">close</span>
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
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
                placeholder="e.g., Michael Foster"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Venue *</label>
              <select
                value={formData.venueId}
                onChange={(e) => handleInputChange('venueId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="">Select venue...</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="staff@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                onBlur={() => setPhoneError(validatePhone(formData.phone || ''))}
                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  phoneError ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
                placeholder="+91 9876543210"
              />
              {phoneError && (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{phoneError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Role *</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
                placeholder="e.g., Senior Coach, Receptionist"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="e.g., Football, Front Desk, Tennis"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Monthly Salary (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.salary}
                onChange={(e) => handleInputChange('salary', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-content py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : staff ? 'Update Staff' : 'Create Staff'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffFormModal;

