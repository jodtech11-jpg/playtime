import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBookings, usePendingBookings } from '../hooks/useBookings';
import { useVenues } from '../hooks/useVenues';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { bookingsCollection, logActivity, notifyVenueManagersOfBookingEvent, usersCollection } from '../services/firebase';
import { Booking, User } from '../types';
import { formatDate, formatTime, getWeekStart, getWeekEnd, getToday } from '../utils/dateUtils';
import { formatCurrency, formatBookingReference, resolveSportName, resolveBookingUserName } from '../utils/formatUtils';
import { exportBookingsToCSV, exportBookingsToPDF } from '../utils/exportUtils';
import BookingDetailsModal from '../components/modals/BookingDetailsModal';
import BookingFormModal from '../components/modals/BookingFormModal';
import SportManagementModal from '../components/modals/SportManagementModal';
import { useSports } from '../hooks/useSports';
import { buildSportStylesMap, getSportStyle } from '../utils/sportUtils';
import { getFirebaseErrorMessage } from '../utils/errorUtils';
import DatePicker from '../components/shared/DatePicker';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import BookingCalendar from '../components/bookings/BookingCalendar';
import { serverTimestamp } from 'firebase/firestore';

const VIEW_MODES = ['day', 'week', 'month'] as const;
const STATUS_OPTIONS = ['All', 'Pending', 'Confirmed', 'Cancelled', 'Completed'] as const;

const Bookings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { showSuccess, showError } = useToast();
  const { user, firebaseUser, isSuperAdmin, hasPermission } = useAuth();
  const actorId = firebaseUser?.uid ?? user?.id;
  const actorEmail = user?.email ?? firebaseUser?.email ?? undefined;
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>(() => {
    const v = searchParams.get('view');
    return VIEW_MODES.includes(v as any) ? (v as 'day' | 'week' | 'month') : 'week';
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = searchParams.get('date');
    if (d) {
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [selectedSport, setSelectedSport] = useState<string>(() => searchParams.get('sport') || 'All Sports');
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => searchParams.get('venue') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || 'All');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showSportModal, setShowSportModal] = useState(false);
  const { sports: sportsCatalog } = useSports({ activeOnly: false, realtime: true });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'default';
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Persist filters to URL so links are shareable
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('view', viewMode);
    next.set('date', selectedDate.toISOString().slice(0, 10));
    next.set('sport', selectedSport === 'All Sports' ? '' : selectedSport);
    if (selectedVenueId) next.set('venue', selectedVenueId); else next.delete('venue');
    if (selectedStatus !== 'All') next.set('status', selectedStatus); else next.delete('status');
    setSearchParams(next, { replace: true });
  }, [viewMode, selectedDate, selectedSport, selectedVenueId, selectedStatus]);

  // Calculate date range based on view mode and selected date
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      // Calculate week start (Monday) based on selected date
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // month - use selected date's month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // Reset end's day to 1 first to prevent day-of-month overflow when calling setMonth
      // e.g. if end is Oct 31, setMonth(10) → "Nov 31" → normalizes to Dec 1, then setDate(0) → Nov 30 (wrong)
      end.setDate(1);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [viewMode, selectedDate]);

  // Fetch bookings
  const { bookings, loading: bookingsLoading, error: bookingsError } = useBookings({
    dateRange,
    sport: selectedSport !== 'All Sports' ? selectedSport : undefined,
    venueId: selectedVenueId || undefined,
    status: selectedStatus !== 'All' ? (selectedStatus as Booking['status']) : undefined,
    realtime: true
  });

  const { bookings: pendingBookings } = usePendingBookings();
  const { venues } = useVenues({ realtime: true });
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const loadedUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const userIds = new Set<string>();
    [...bookings, ...pendingBookings].forEach((booking) => {
      if (!booking.user?.trim() && booking.userId && booking.userId !== 'admin-walk-in') {
        userIds.add(booking.userId);
      }
    });

    const missingIds = [...userIds].filter((id) => !loadedUserIdsRef.current.has(id));
    if (missingIds.length === 0) return;

    let cancelled = false;
    missingIds.forEach((id) => loadedUserIdsRef.current.add(id));

    Promise.all(
      missingIds.map(async (id) => {
        const doc = await usersCollection.get(id);
        return { id, user: doc as User | null };
      })
    ).then((results) => {
      if (cancelled) return;
      setUsersById((prev) => {
        const next = { ...prev };
        results.forEach(({ id, user }) => {
          if (user) next[id] = user;
        });
        return next;
      });
    }).catch((err) => {
      console.error('Failed to load booking user names:', err);
      missingIds.forEach((id) => loadedUserIdsRef.current.delete(id));
    });

    return () => {
      cancelled = true;
    };
  }, [bookings, pendingBookings]);

  const getBookingUserName = useCallback((booking: Booking): string => {
    const name = resolveBookingUserName(booking, usersById);
    return name || '…';
  }, [usersById]);

  // Generate days for week view based on selected date
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    // Calculate week start (Monday) based on selected date
    const dayOfWeek = start.getDay();
    const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const days = [];
    const today = getToday();
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate().toString(),
        fullDate: date,
        isToday: date.toDateString() === today.toDateString()
      });
    }
    return days;
  }, [selectedDate, viewMode]);

  // Dynamic sport colors from catalog
  const sportStyles = useMemo(() => buildSportStylesMap(sportsCatalog), [sportsCatalog]);

  // All configured sports (not just sports appearing in existing bookings)
  const availableSports = useMemo(() => {
    if (sportsCatalog.length > 0) {
      return sportsCatalog.map((s) => s.name).sort();
    }
    const fromBookings = new Set<string>();
    bookings.forEach((booking) => {
      if (booking.sport) {
        fromBookings.add(resolveSportName(booking.sport, sportsCatalog));
      }
    });
    return Array.from(fromBookings).sort();
  }, [bookings, sportsCatalog]);

  // Resolve booking (from list or modal) for venueId
  const getBookingVenueId = (bookingId: string): string | undefined => {
    const b = bookings.find((x) => x.id === bookingId) || pendingBookings.find((x) => x.id === bookingId) || (selectedBooking?.id === bookingId ? selectedBooking : null);
    return b?.venueId;
  };

  const getBookingById = (bookingId: string): Booking | undefined => {
    return bookings.find((x) => x.id === bookingId)
      || pendingBookings.find((x) => x.id === bookingId)
      || (selectedBooking?.id === bookingId ? selectedBooking : undefined);
  };

  // Find another active booking on the same court with an overlapping time range
  const findConflictingBooking = (booking: Booking): Booking | undefined => {
    if (!booking.courtId || !booking.startTime || !booking.endTime) return undefined;
    const toDate = (value: any): Date => (value?.toDate ? value.toDate() : new Date(value));
    const start = toDate(booking.startTime);
    const end = toDate(booking.endTime);
    return bookings.find((b) =>
      b.id !== booking.id &&
      b.courtId === booking.courtId &&
      (b.status === 'Pending' || b.status === 'Confirmed') &&
      b.startTime && b.endTime &&
      toDate(b.startTime) < end && toDate(b.endTime) > start
    );
  };

  // Handle booking actions
  const handleAccept = async (bookingId: string) => {
    const booking = getBookingById(bookingId);
    if (booking && findConflictingBooking(booking)) {
      showError('Cannot confirm: this booking overlaps another active booking on the same court.');
      return;
    }
    try {
      setProcessing(bookingId);
      await bookingsCollection.update(bookingId, {
        status: 'Confirmed',
        updatedAt: serverTimestamp()
      });
      const venueId = getBookingVenueId(bookingId);
      if (venueId) {
        await notifyVenueManagersOfBookingEvent({
          venueId,
          bookingId,
          eventType: 'booking_confirmed',
          title: 'Booking confirmed',
          body: `Booking #${bookingId.slice(0, 8)} has been confirmed.`
        });
      }
      if (actorId) {
        await logActivity({
          userId: actorId,
          userEmail: actorEmail,
          action: 'booking_confirmed',
          targetType: 'booking',
          targetId: bookingId,
          details: { status: 'Confirmed' },
        });
      }
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      showError('Failed to accept booking: ' + getFirebaseErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setConfirmDialog({
      title: 'Reject Booking',
      message: 'Are you sure you want to reject this booking? The user will be notified.',
      confirmLabel: 'Reject',
      variant: 'danger',
      onConfirm: async () => { await _doReject(bookingId); },
    });
  };

  const _doReject = async (bookingId: string) => {

    try {
      setProcessing(bookingId);
      await bookingsCollection.update(bookingId, {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      const venueId = getBookingVenueId(bookingId);
      if (venueId) {
        await notifyVenueManagersOfBookingEvent({
          venueId,
          bookingId,
          eventType: 'booking_rejected',
          title: 'Booking rejected',
          body: `Booking #${bookingId.slice(0, 8)} was rejected.`
        });
      }
      if (actorId) {
        await logActivity({
          userId: actorId,
          userEmail: actorEmail,
          action: 'booking_rejected',
          targetType: 'booking',
          targetId: bookingId,
          details: { status: 'Cancelled' },
        });
      }
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      showError('Failed to reject booking: ' + getFirebaseErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setConfirmDialog({
      title: 'Cancel Booking',
      message: 'Are you sure you want to cancel this booking? This action cannot be undone.',
      confirmLabel: 'Cancel Booking',
      variant: 'danger',
      onConfirm: async () => { await _doCancel(bookingId); },
    });
  };

  const _doCancel = async (bookingId: string) => {
    try {
      setProcessing(bookingId);
      await bookingsCollection.update(bookingId, {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      const venueId = getBookingVenueId(bookingId);
      if (venueId) {
        await notifyVenueManagersOfBookingEvent({
          venueId,
          bookingId,
          eventType: 'booking_cancelled',
          title: 'Booking cancelled',
          body: `Booking #${bookingId.slice(0, 8)} was cancelled.`
        });
      }
      if (actorId) {
        await logActivity({
          userId: actorId,
          userEmail: actorEmail,
          action: 'booking_cancelled',
          targetType: 'booking',
          targetId: bookingId,
          details: { status: 'Cancelled' },
        });
      }
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      showError('Failed to cancel booking: ' + getFirebaseErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    if (selectedIds.size === pendingBookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingBookings.map((b) => b.id)));
    }
  };

  const handleBulkConfirm = async () => {
    const ids = Array.from(selectedIds);
    const toConfirm = ids.filter((id) => {
      const b = pendingBookings.find((x) => x.id === id);
      return b && b.status === 'Pending';
    });
    if (toConfirm.length === 0) {
      showError('No pending bookings selected.');
      return;
    }
    setConfirmDialog({
      title: `Confirm ${toConfirm.length} Booking${toConfirm.length > 1 ? 's' : ''}`,
      message: `This will confirm ${toConfirm.length} pending booking${toConfirm.length > 1 ? 's' : ''}. Users will be notified.`,
      confirmLabel: 'Confirm All',
      variant: 'default',
      onConfirm: async () => { await _doBulkConfirm(toConfirm); },
    });
  };

  const _doBulkConfirm = async (toConfirm: string[]) => {
    try {
      setBulkProcessing(true);
      let confirmedCount = 0;
      let skippedCount = 0;
      for (const bookingId of toConfirm) {
        const booking = getBookingById(bookingId);
        if (booking && findConflictingBooking(booking)) {
          skippedCount++;
          continue;
        }
        const venueId = getBookingVenueId(bookingId);
        await bookingsCollection.update(bookingId, {
          status: 'Confirmed',
          updatedAt: serverTimestamp(),
        });
        if (venueId) {
          await notifyVenueManagersOfBookingEvent({
            venueId,
            bookingId,
            eventType: 'booking_confirmed',
            title: 'Booking confirmed',
            body: `Booking #${bookingId.slice(0, 8)} has been confirmed.`,
          });
        }
        if (actorId) {
          await logActivity({
            userId: actorId,
            userEmail: actorEmail,
            action: 'booking_confirmed',
            targetType: 'booking',
            targetId: bookingId,
            details: { status: 'Confirmed' },
          });
        }
        confirmedCount++;
      }
      setSelectedIds(new Set());
      if (skippedCount > 0) {
        showError(`Skipped ${skippedCount} booking(s) that overlap another active booking on the same court.`);
      }
      if (confirmedCount > 0) {
        showSuccess(`Confirmed ${confirmedCount} booking(s).`);
      }
    } catch (error: any) {
      console.error('Bulk confirm error:', error);
      showError('Failed to confirm some bookings: ' + getFirebaseErrorMessage(error));
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showError('No bookings selected.');
      return;
    }
    setConfirmDialog({
      title: `Cancel ${ids.length} Booking${ids.length > 1 ? 's' : ''}`,
      message: `This will cancel ${ids.length} booking${ids.length > 1 ? 's' : ''}. This cannot be undone.`,
      confirmLabel: 'Cancel All',
      variant: 'danger',
      onConfirm: async () => { await _doBulkCancel(ids); },
    });
  };

  const _doBulkCancel = async (ids: string[]) => {
    try {
      setBulkProcessing(true);
      for (const bookingId of ids) {
        const venueId = getBookingVenueId(bookingId);
        await bookingsCollection.update(bookingId, {
          status: 'Cancelled',
          updatedAt: serverTimestamp(),
        });
        if (venueId) {
          await notifyVenueManagersOfBookingEvent({
            venueId,
            bookingId,
            eventType: 'booking_cancelled',
            title: 'Booking cancelled',
            body: `Booking #${bookingId.slice(0, 8)} was cancelled.`,
          });
        }
        if (actorId) {
          await logActivity({
            userId: actorId,
            userEmail: actorEmail,
            action: 'booking_cancelled',
            targetType: 'booking',
            targetId: bookingId,
            details: { status: 'Cancelled' },
          });
        }
      }
      setSelectedIds(new Set());
      showSuccess(`Cancelled ${ids.length} booking(s).`);
    } catch (error: any) {
      console.error('Bulk cancel error:', error);
      showError('Failed to cancel some bookings: ' + getFirebaseErrorMessage(error));
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleCreateBooking = () => {
    setIsCreateModalOpen(true);
  };

  const handleSaveBooking = async (bookingData: Partial<Booking>) => {
    try {
      setProcessing('creating');
      const bookingId = await bookingsCollection.create({
        ...bookingData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (actorId) {
        await logActivity({
          userId: actorId,
          userEmail: actorEmail,
          action: 'booking_created',
          targetType: 'booking',
          targetId: bookingId,
          details: {
            user: bookingData.user,
            venueId: bookingData.venueId,
            court: bookingData.court,
            status: bookingData.status,
          },
        });
      }
      if (bookingData.venueId) {
        await notifyVenueManagersOfBookingEvent({
          venueId: bookingData.venueId,
          bookingId,
          eventType: 'booking_created',
          title: 'New reservation',
          body: `Force reservation for ${bookingData.user} at ${bookingData.court}.`,
        });
      }
      showSuccess('Booking created successfully.');
      setIsCreateModalOpen(false);
    } catch (error: any) {
      console.error('Error creating booking:', error);
      showError('Failed to create booking: ' + getFirebaseErrorMessage(error));
      throw error;
    } finally {
      setProcessing(null);
    }
  };

  // Keyboard shortcut: Ctrl+N / Cmd+N → new booking
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateBooking();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(handleCreateBooking);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const modals = (
    <>
      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBooking(null);
        }}
        onAccept={handleAccept}
        onReject={handleReject}
        onCancel={handleCancel}
        sports={sportsCatalog}
      />

      <BookingFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleSaveBooking}
      />

      <SportManagementModal
        isOpen={showSportModal}
        onClose={() => setShowSportModal(false)}
        sports={sportsCatalog}
        onUpdate={() => {}}
      />

      <DatePicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        initialDate={selectedDate}
        viewMode={viewMode}
      />

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        variant={confirmDialog?.variant || 'danger'}
        loading={confirmLoading}
        onConfirm={async () => {
          if (!confirmDialog) return;
          setConfirmLoading(true);
          try {
            await confirmDialog.onConfirm();
          } finally {
            setConfirmLoading(false);
            setConfirmDialog(null);
          }
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );

  if (bookingsLoading) {
    return (
      <>
        <div className="p-4 sm:p-8 flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600 font-medium">Loading bookings...</p>
          </div>
        </div>
        {modals}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {bookingsError && (
        <div className="flex-shrink-0 mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {bookingsError}
        </div>
      )}
      {/* Header Controls */}
      <div className="flex-shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6">
        <div role="tablist" aria-label="Calendar view" className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm h-12 w-fit">
          <button
            role="tab"
            aria-selected={viewMode === 'day'}
            onClick={() => setViewMode('day')}
            className={`px-6 h-full rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 ${viewMode === 'day' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Daily
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'week'}
            onClick={() => setViewMode('week')}
            className={`px-6 h-full rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 ${viewMode === 'week' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Weekly
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'month'}
            onClick={() => setViewMode('month')}
            className={`px-6 h-full rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 ${viewMode === 'month' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Monthly
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeline Navigator */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-12 px-1 shadow-sm">
            <button
              onClick={() => {
                const newDate = new Date(selectedDate);
                if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
                else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
                else newDate.setMonth(newDate.getMonth() - 1);
                setSelectedDate(newDate);
              }}
              aria-label="Previous period"
              className="size-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">chevron_left</span>
            </button>
            <button
              onClick={() => setShowDatePicker(true)}
              className="px-4 h-10 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-slate-400 text-lg">calendar_month</span>
              {viewMode === 'week'
                ? `${formatDate(weekDays[0].fullDate)} - ${formatDate(weekDays[6].fullDate)}`
                : viewMode === 'month'
                  ? selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : formatDate(selectedDate)
              }
            </button>
            <button
              onClick={() => {
                const newDate = new Date(selectedDate);
                if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
                else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
                else newDate.setMonth(newDate.getMonth() + 1);
                setSelectedDate(newDate);
              }}
              aria-label="Next period"
              className="size-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">chevron_right</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleToday}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Today
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer min-w-[140px]"
            >
              <option value="">All Venues</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer min-w-[120px]"
              >
                <option>All Sports</option>
                {availableSports.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
              {isSuperAdmin && (
              <button
                onClick={() => setShowSportModal(true)}
                className="size-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-primary rounded-xl shadow-sm hover:scale-105 transition-all flex items-center justify-center shrink-0"
                aria-label="Manage sports"
                title="Add / manage sports"
              >
                <span className="material-symbols-outlined font-black">add</span>
              </button>
              )}
            </div>

            <div className="h-12 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              {hasPermission('bookings.create') && (
              <button
                onClick={handleCreateBooking}
                className="size-12 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center shrink-0"
                aria-label="Force Reservation"
                title="Force Reservation"
              >
                <span className="material-symbols-outlined font-black">event_available</span>
              </button>
              )}

              <div className="relative group">
                <button
                  aria-label="Export bookings"
                  title="Export bookings"
                  className="size-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-primary transition-all shadow-sm rounded-xl flex items-center justify-center"
                >
                  <span className="material-symbols-outlined">download</span>
                </button>
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] p-1">
                  <button
                    onClick={() => exportBookingsToCSV(bookings, venues)}
                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">database</span>
                    Dump CSV
                  </button>
                  <button
                    onClick={() => exportBookingsToPDF(bookings, `Bookings Report`, venues)}
                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    Secure PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 xl:gap-8 flex-1 min-h-0">
        {/* Responsive day/week/month calendar */}
        <div className="xl:col-span-8 min-h-0 min-w-0">
          <BookingCalendar
            bookings={bookings}
            venues={venues}
            sports={sportsCatalog}
            selectedDate={selectedDate}
            viewMode={viewMode}
            selectedVenueId={selectedVenueId}
            getUserName={getBookingUserName}
            onBookingClick={handleBookingClick}
            onDateClick={(date) => {
              setSelectedDate(date);
              setViewMode('day');
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setQueueOpen((open) => !open)}
          aria-expanded={queueOpen}
          className="xl:hidden flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          Pending bookings
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{pendingBookings.length}</span>
            <span className="material-symbols-outlined">{queueOpen ? 'expand_less' : 'expand_more'}</span>
          </span>
        </button>

        {/* Sidebar - collapsible below desktop width */}
        <div className={`xl:col-span-4 ${queueOpen ? 'flex' : 'hidden'} xl:flex flex-col min-h-0 overflow-hidden`} style={{ minHeight: 0 }}>
          {/* Sport Legend - inline bar at top */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Legend:</span>
            <div className="flex flex-wrap gap-1.5">
              {(sportsCatalog.length > 0 ? sportsCatalog.filter((s) => s.isActive !== false) : []).map((sport) => {
                const style = sportStyles[sport.name] || getSportStyle(sport.name, sportsCatalog);
                return (
                  <span key={sport.id} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/50">
                    <span
                      className="size-2 rounded-full border"
                      style={{ backgroundColor: style.backgroundColor, borderColor: style.borderColor }}
                    />
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{sport.name}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Active Queue - full height scrollable panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Active Queue</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Awaiting verification</p>
                </div>
                {pendingBookings.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {pendingBookings.length}
                  </span>
                )}
              </div>
              {pendingBookings.length > 0 && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === pendingBookings.length && pendingBookings.length > 0}
                      onChange={selectAllPending}
                      className="rounded border-slate-300 text-primary focus:ring-primary size-4"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select all</span>
                  </label>
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
                      <button
                        type="button"
                        onClick={handleBulkConfirm}
                        disabled={bulkProcessing}
                        className="h-7 px-3 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        Confirm all
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkCancel}
                        disabled={bulkProcessing}
                        className="h-7 px-3 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-300 disabled:opacity-50"
                      >
                        Cancel all
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable list - compact single-row items */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 scrollbar-visible">
              {pendingBookings.length > 0 ? (
                <ul className="space-y-2">
                  {pendingBookings.map((booking) => {
                    const venue = venues.find(v => v.id === booking.venueId);
                    const isSelected = selectedIds.has(booking.id);
                    return (
                      <li
                        key={booking.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                          isSelected
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300'
                        }`}
                        onClick={() => handleBookingClick(booking)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleSelection(booking.id); }}
                          className="rounded border-slate-300 text-primary focus:ring-primary size-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-400">{formatBookingReference(booking.id)}</span>
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{getBookingUserName(booking)}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {formatTime(booking.startTime)} • {venue?.name || '—'} • {formatCurrency(booking.amount)}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleAccept(booking.id)}
                            disabled={processing === booking.id}
                            className="h-7 px-2.5 bg-primary text-white text-[10px] font-bold rounded-md hover:bg-primary/90 disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleReject(booking.id)}
                            disabled={processing === booking.id}
                            className="h-7 px-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-md hover:bg-slate-300 disabled:opacity-50"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">All clear</p>
                  <p className="text-xs text-slate-500 mt-1">No pending verifications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modals}
    </div>
  );
};

export default Bookings;
