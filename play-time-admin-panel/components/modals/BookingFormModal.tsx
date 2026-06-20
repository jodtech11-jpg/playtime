import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Booking, Court } from '../../types';
import { useVenues } from '../../hooks/useVenues';
import { courtsCollection } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatUtils';

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookingData: Partial<Booking>) => Promise<void>;
}

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 3];
const TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const hour = 8 + i;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { venues } = useVenues({ realtime: true, status: 'Active' });
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    venueId: '',
    courtId: '',
    user: '',
    userPhone: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    duration: 1,
    status: 'Confirmed' as Booking['status'],
    paymentStatus: 'Paid' as Booking['paymentStatus'],
    paymentMethod: 'Cash' as Booking['paymentMethod'],
    amount: 0,
  });

  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      venueId: venues.length > 0 ? venues[0].id : '',
      courtId: '',
      user: '',
      userPhone: '',
      date: new Date().toISOString().slice(0, 10),
      startTime: '09:00',
      duration: 1,
      status: 'Confirmed',
      paymentStatus: 'Paid',
      paymentMethod: 'Cash',
      amount: 0,
    });
    setError(null);
  }, [isOpen, venues]);

  useEffect(() => {
    if (!formData.venueId) {
      setCourts([]);
      return;
    }

    let mounted = true;
    const loadCourts = async () => {
      setCourtsLoading(true);
      try {
        const data = (await courtsCollection.getAll([
          { field: 'venueId', operator: '==', value: formData.venueId },
        ])) as Court[];
        const active = data.filter((c) => c.status === 'Active');
        if (mounted) {
          setCourts(active);
          if (active.length > 0) {
            const first = active[0];
            setFormData((prev) => ({
              ...prev,
              courtId: first.id,
              amount: first.pricePerHour * prev.duration,
            }));
          } else {
            setFormData((prev) => ({ ...prev, courtId: '', amount: 0 }));
          }
        }
      } catch (err) {
        console.error('Error loading courts:', err);
        if (mounted) setCourts([]);
      } finally {
        if (mounted) setCourtsLoading(false);
      }
    };

    loadCourts();
    return () => {
      mounted = false;
    };
  }, [formData.venueId]);

  const selectedCourt = courts.find((c) => c.id === formData.courtId);

  const handleCourtChange = (courtId: string) => {
    const court = courts.find((c) => c.id === courtId);
    setFormData((prev) => ({
      ...prev,
      courtId,
      amount: court ? court.pricePerHour * prev.duration : 0,
    }));
  };

  const handleDurationChange = (duration: number) => {
    setFormData((prev) => ({
      ...prev,
      duration,
      amount: selectedCourt ? selectedCourt.pricePerHour * duration : prev.amount,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.venueId || !formData.courtId || !formData.user.trim()) {
      setError('Venue, court, and customer name are required.');
      return;
    }

    const court = courts.find((c) => c.id === formData.courtId);
    if (!court) {
      setError('Please select a valid court.');
      return;
    }

    const [hours, minutes] = formData.startTime.split(':').map(Number);
    const startDate = new Date(formData.date);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + formData.duration * 60 * 60 * 1000);

    setLoading(true);
    try {
      await onSave({
        venueId: formData.venueId,
        courtId: formData.courtId,
        court: court.name,
        sport: court.sport,
        user: formData.user.trim(),
        userId: 'admin-walk-in',
        date: formData.date,
        time: formData.startTime,
        startTime: Timestamp.fromDate(startDate),
        endTime: Timestamp.fromDate(endDate),
        duration: formData.duration,
        status: formData.status,
        amount: formData.amount,
        paymentStatus: formData.paymentStatus,
        paymentMethod: formData.paymentMethod,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Force Reservation</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Create a booking on behalf of a customer
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Venue *
              </label>
              <select
                value={formData.venueId}
                onChange={(e) => setFormData((prev) => ({ ...prev, venueId: e.target.value, courtId: '' }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select venue...</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Court *
              </label>
              <select
                value={formData.courtId}
                onChange={(e) => handleCourtChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                required
                disabled={courtsLoading || courts.length === 0}
              >
                <option value="">
                  {courtsLoading ? 'Loading courts...' : courts.length === 0 ? 'No active courts' : 'Select court...'}
                </option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.sport}) — {formatCurrency(c.pricePerHour)}/hr
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                value={formData.user}
                onChange={(e) => setFormData((prev) => ({ ...prev, user: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                placeholder="Walk-in customer name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Customer Phone
              </label>
              <input
                type="tel"
                value={formData.userPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, userPhone: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                placeholder="+91 9876543210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Start Time *
              </label>
              <select
                value={formData.startTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                required
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Duration (hrs) *
              </label>
              <select
                value={formData.duration}
                onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                required
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} hr{d !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Booking['status'] }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Payment Status
              </label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentStatus: e.target.value as Booking['paymentStatus'] }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value as Booking['paymentMethod'] }))}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
              >
                <option value="Cash">Cash</option>
                <option value="Offline">Offline</option>
                <option value="Online">Online</option>
              </select>
            </div>
          </div>

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Total Amount
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary text-xl font-black"
              />
              {selectedCourt && (
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  Auto: {formatCurrency(selectedCourt.pricePerHour)}/hr × {formData.duration}hr
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || courts.length === 0}
              className="flex-1 bg-primary text-primary-content py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingFormModal;
