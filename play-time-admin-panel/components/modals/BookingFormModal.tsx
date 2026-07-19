import React, { useState, useEffect, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Booking, Court } from '../../types';
import { useVenues } from '../../hooks/useVenues';
import { useSports } from '../../hooks/useSports';
import { bookingsCollection, courtsCollection } from '../../services/firebase';
import { formatCurrency, resolveSportName } from '../../utils/formatUtils';
import { getSportsForVenue, findSport, cleanSportOptions } from '../../utils/sportUtils';
import SportOptionsFields from '../shared/SportOptionsFields';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';

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

const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { firebaseUser } = useAuth();
  const { venues } = useVenues({ realtime: true, status: 'Active' });
  const { sports: sportsCatalog } = useSports({ activeOnly: true, realtime: false });
  const { users } = useUsers({ limit: 100, usePagination: false });
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sportFilter, setSportFilter] = useState('');
  const [sportOptions, setSportOptions] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    venueId: '',
    courtId: '',
    customerId: '',
    user: '',
    userPhone: '',
    date: toLocalDateInputValue(new Date()),
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
      customerId: '',
      user: '',
      userPhone: '',
      date: toLocalDateInputValue(new Date()),
      startTime: '09:00',
      duration: 1,
      status: 'Confirmed',
      paymentStatus: 'Paid',
      paymentMethod: 'Cash',
      amount: 0,
    });
    setSportFilter('');
    setSportOptions({});
    setError(null);
  }, [isOpen, venues]);

  const selectedVenue = venues.find((v) => v.id === formData.venueId);
  const venueSports = useMemo(
    () => getSportsForVenue(selectedVenue, sportsCatalog),
    [selectedVenue, sportsCatalog]
  );

  const filteredCourts = sportFilter
    ? courts.filter(
        (c) => resolveSportName(c.sportId || c.sport, sportsCatalog) === sportFilter
      )
    : courts;

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

  // Keep courtId in sync with the sport-filtered court list: auto-select the
  // first available court, and clear the selection when the filter excludes it.
  useEffect(() => {
    if (!isOpen) return;
    const selectable = sportFilter
      ? courts.filter(
          (c) => resolveSportName(c.sportId || c.sport, sportsCatalog) === sportFilter
        )
      : courts;
    setFormData((prev) => {
      if (prev.courtId && selectable.some((c) => c.id === prev.courtId)) return prev;
      const first = selectable[0];
      return {
        ...prev,
        courtId: first ? first.id : '',
        amount: first ? first.pricePerHour * prev.duration : 0,
      };
    });
  }, [isOpen, courts, sportFilter, sportsCatalog]);

  const selectedCourt = courts.find((c) => c.id === formData.courtId);

  const activeSportRecord = useMemo(() => {
    if (selectedCourt) {
      return findSport(selectedCourt.sportId || selectedCourt.sport, sportsCatalog);
    }
    if (sportFilter) {
      return findSport(sportFilter, sportsCatalog);
    }
    return undefined;
  }, [selectedCourt, sportFilter, sportsCatalog]);

  const handleCourtChange = (courtId: string) => {
    const court = courts.find((c) => c.id === courtId);
    setFormData((prev) => ({
      ...prev,
      courtId,
      amount: court ? court.pricePerHour * prev.duration : 0,
    }));
    setSportOptions({});
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
    const startDate = parseLocalDateTime(formData.date, hours, minutes);
    const endDate = new Date(startDate.getTime() + formData.duration * 60 * 60 * 1000);

    setLoading(true);
    try {
      // Reject slots that overlap an existing active booking on the same court.
      // Always scope by venueId so venue managers pass Firestore security rules.
      const existing = (await bookingsCollection.getAll([
        { field: 'venueId', operator: '==', value: formData.venueId },
        { field: 'courtId', operator: '==', value: formData.courtId },
      ])) as Booking[];
      const toDate = (value: any): Date => (value?.toDate ? value.toDate() : new Date(value));
      const conflict = existing.find((b) => {
        if (b.status !== 'Pending' && b.status !== 'Confirmed') return false;
        if (!b.startTime || !b.endTime) return false;
        return toDate(b.startTime) < endDate && toDate(b.endTime) > startDate;
      });
      if (conflict) {
        setError('This time slot overlaps an existing booking on this court. Please choose a different time.');
        setLoading(false);
        return;
      }

      // Walk-in bookings: store the customer name in `user`, but set userId to the
      // signed-in admin so Firestore create rules (createdByCaller / ownsVenue) pass.
      const actorUid = firebaseUser?.uid;
      if (!actorUid) {
        setError('You must be signed in to create a booking.');
        setLoading(false);
        return;
      }

      const normalizedPhone = formData.userPhone.replace(/\D/g, '');
      const phoneMatches = normalizedPhone
        ? users.filter(
            (candidate) =>
              candidate.role === 'player' &&
              (candidate.phone || '').replace(/\D/g, '') === normalizedPhone
          )
        : [];
      const matchedCustomer =
        users.find((candidate) => candidate.id === formData.customerId) ||
        (phoneMatches.length === 1 ? phoneMatches[0] : undefined);

      await onSave({
        venueId: formData.venueId,
        courtId: formData.courtId,
        court: court.name,
        sport: resolveSportName(court.sportId || court.sport, sportsCatalog) || court.sport,
        sportId: court.sportId || findSport(court.sport, sportsCatalog)?.id,
        sportOptions: cleanSportOptions(sportOptions),
        user: formData.user.trim(),
        userId: matchedCustomer?.id || actorUid,
        userPhone: formData.userPhone.trim() || undefined,
        createdBy: actorUid,
        bookingSource: matchedCustomer ? 'customer' : 'walk_in',
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
      setError(getFirebaseErrorMessage(err) || 'Failed to create booking');
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
            <div className="sm:col-span-2">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Existing Customer Account
              </label>
              <select
                value={formData.customerId}
                onChange={(event) => {
                  const customer = users.find((candidate) => candidate.id === event.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    customerId: event.target.value,
                    user: customer?.name || prev.user,
                    userPhone: customer?.phone || prev.userPhone,
                  }));
                }}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
              >
                <option value="">Walk-in / no linked account</option>
                {users
                  .filter((candidate) => candidate.role === 'player')
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} — {candidate.phone || candidate.email}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                A unique phone match is linked automatically; otherwise this remains a walk-in booking.
              </p>
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Venue *
              </label>
              <select
                value={formData.venueId}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, venueId: e.target.value, courtId: '' }));
                  setSportFilter('');
                  setSportOptions({});
                }}
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
                Sport
              </label>
              <select
                value={sportFilter}
                onChange={(e) => {
                  setSportFilter(e.target.value);
                  setFormData((prev) => ({ ...prev, courtId: '' }));
                  setSportOptions({});
                }}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                disabled={!formData.venueId}
              >
                <option value="">All sports at venue</option>
                {venueSports.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {activeSportRecord && (
              <div className="sm:col-span-2">
                <SportOptionsFields
                  sport={activeSportRecord}
                  values={sportOptions}
                  onChange={setSportOptions}
                  compact
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-2">
                Court *
              </label>
              <select
                value={formData.courtId}
                onChange={(e) => handleCourtChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary"
                required
                disabled={courtsLoading || filteredCourts.length === 0}
              >
                <option value="">
                  {courtsLoading ? 'Loading courts...' : filteredCourts.length === 0 ? 'No active courts' : 'Select court...'}
                </option>
                {filteredCourts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({resolveSportName(c.sport, sportsCatalog)}) — {formatCurrency(c.pricePerHour)}/hr
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
              disabled={loading || filteredCourts.length === 0}
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
