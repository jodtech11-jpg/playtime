import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBookings, usePendingBookings } from '../hooks/useBookings';
import { useVenues } from '../hooks/useVenues';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { bookingsCollection, logActivity, notifyVenueManagersOfBookingEvent } from '../services/firebase';
import { Booking } from '../types';
import { formatDate, formatTime, getWeekStart, getWeekEnd, getToday } from '../utils/dateUtils';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { exportBookingsToCSV, exportBookingsToPDF } from '../utils/exportUtils';
import BookingDetailsModal from '../components/modals/BookingDetailsModal';
import DatePicker from '../components/shared/DatePicker';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { serverTimestamp } from 'firebase/firestore';

const VIEW_MODES = ['day', 'week', 'month'] as const;
const STATUS_OPTIONS = ['All', 'Pending', 'Confirmed', 'Cancelled', 'Completed'] as const;

const Bookings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
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
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  const { bookings, loading: bookingsLoading } = useBookings({
    dateRange,
    sport: selectedSport !== 'All Sports' ? selectedSport : undefined,
    venueId: selectedVenueId || undefined,
    status: selectedStatus !== 'All' ? (selectedStatus as Booking['status']) : undefined,
    realtime: true
  });

  const { bookings: pendingBookings } = usePendingBookings();
  const { venues } = useVenues({ realtime: true });

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

  // Generate time slots (8 AM to 10 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      const time = new Date();
      time.setHours(hour, 0, 0, 0);
      slots.push({
        hour,
        label: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      });
    }
    return slots;
  }, []);

  // Sport color configuration
  const sportStyles: Record<string, { bg: string; border: string; text: string }> = {
    'Football': { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900' },
    'Tennis': { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-900' },
    'Badminton': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-900' },
    'Cricket': { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-900' },
    'Basketball': { bg: 'bg-pink-50', border: 'border-pink-500', text: 'text-pink-900' },
  };

  // Get unique sports from bookings
  const availableSports = useMemo(() => {
    const sports = new Set<string>();
    bookings.forEach(booking => {
      if (booking.sport) sports.add(booking.sport);
    });
    return Array.from(sports);
  }, [bookings]);

  // Calculate booking position on calendar
  const getBookingPosition = (booking: Booking) => {
    if (!booking.startTime) return null;

    const startDate = booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
    const endDate = booking.endTime.toDate ? booking.endTime.toDate() : new Date(booking.endTime);

    // Find day index
    const dayIndex = weekDays.findIndex(day =>
      day.fullDate.toDateString() === startDate.toDateString()
    );
    if (dayIndex === -1) return null;

    // Find time slot index
    const startHour = startDate.getHours();
    const timeIndex = timeSlots.findIndex(slot => slot.hour === startHour);
    if (timeIndex === -1) return null;

    // Calculate duration in hours
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    return {
      dayIndex,
      timeIndex,
      duration: durationHours,
      startDate,
      endDate
    };
  };

  // Resolve booking (from list or modal) for venueId
  const getBookingVenueId = (bookingId: string): string | undefined => {
    const b = bookings.find((x) => x.id === bookingId) || pendingBookings.find((x) => x.id === bookingId) || (selectedBooking?.id === bookingId ? selectedBooking : null);
    return b?.venueId;
  };

  // Handle booking actions
  const handleAccept = async (bookingId: string) => {
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
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      showError('Failed to accept booking: ' + error.message);
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
      if (user) {
        await logActivity({
          userId: user.uid,
          userEmail: user.email ?? undefined,
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
      showError('Failed to reject booking: ' + error.message);
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
      if (user) {
        await logActivity({
          userId: user.uid,
          userEmail: user.email ?? undefined,
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
      showError('Failed to cancel booking: ' + error.message);
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
      for (const bookingId of toConfirm) {
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
        if (user) {
          await logActivity({
            userId: user.uid,
            userEmail: user.email ?? undefined,
            action: 'booking_confirmed',
            targetType: 'booking',
            targetId: bookingId,
            details: { status: 'Confirmed' },
          });
        }
      }
      setSelectedIds(new Set());
      showSuccess(`Confirmed ${toConfirm.length} booking(s).`);
    } catch (error: any) {
      console.error('Bulk confirm error:', error);
      showError('Failed to confirm some bookings: ' + error.message);
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
        if (user) {
          await logActivity({
            userId: user.uid,
            userEmail: user.email ?? undefined,
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
      showError('Failed to cancel some bookings: ' + error.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleCreateBooking = () => {
    // Open modal with empty booking for creation
    setSelectedBooking(null);
    setIsModalOpen(true);
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

  if (bookingsLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Header Controls */}
      <div className="flex-shrink-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6">
        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm h-12 w-fit">
          <button
            onClick={() => setViewMode('day')}
            className={`px-6 h-full rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 ${viewMode === 'day' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-6 h-full rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 ${viewMode === 'week' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Weekly
          </button>
          <button
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
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm cursor-pointer"
            >
              <option>All Sports</option>
              {availableSports.map(sport => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>

            <div className="h-12 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateBooking}
                className="size-12 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center"
                aria-label="Force Reservation"
                title="Force Reservation"
              >
                <span className="material-symbols-outlined font-black">add</span>
              </button>

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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 flex-1 min-h-0 overflow-hidden">
        {/* Calendar View */}
        <div className="xl:col-span-8 ui-card flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-800">
          {/* Header Row */}
          <div className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="p-4 border-r border-slate-100 dark:border-slate-700 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center">
              TIMELINE
            </div>
            {weekDays.map((day, idx) => (
              <div
                key={idx}
                className={`p-4 border-r border-slate-100 dark:border-slate-700 text-center transition-colors ${day.isToday ? 'bg-primary/5 dark:bg-primary/10' : ''
                  }`}
              >
                <p className={`text-[10px] uppercase font-black tracking-widest ${day.isToday ? 'text-primary' : 'text-slate-400'}`}>
                  {day.name}
                </p>
                <p className={`text-2xl font-black mt-1 ${day.isToday ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                  {day.date}
                </p>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-visible relative bg-white dark:bg-slate-900">
            <div className="grid grid-cols-8 min-h-full">
              {/* Time Column */}
              <div className="col-span-1 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                {timeSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="h-28 border-b border-slate-100 dark:border-slate-800 flex items-start pt-4 justify-center text-[10px] font-black text-slate-400 uppercase tracking-tighter"
                  >
                    {slot.label}
                  </div>
                ))}
              </div>

              {/* Calendar Grid Area */}
              <div className="col-span-7 relative">
                {/* Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="border-r border-slate-50/50 dark:border-slate-800/50 last:border-r-0 h-full"></div>
                  ))}
                </div>
                <div className="absolute inset-0 pointer-events-none">
                  {timeSlots.map((_, i) => (
                    <div key={i} className="h-28 border-b border-slate-50/50 dark:border-slate-800/50 last:border-b-0 w-full"></div>
                  ))}
                </div>

                {/* Empty state overlay */}
                {bookings.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-10">
                    <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 mb-3">
                      <span className="material-symbols-outlined text-3xl">event_busy</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No bookings</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedStatus !== 'All' || selectedVenueId || selectedSport !== 'All Sports'
                        ? 'Try adjusting your filters'
                        : 'No bookings for this period'}
                    </p>
                  </div>
                )}

                {/* Bookings */}
                {bookings.map((booking) => {
                  const position = getBookingPosition(booking);
                  if (!position) return null;

                  const style = sportStyles[booking.sport] || sportStyles['Football'];
                  const statusColors = getStatusColor(booking.status);

                  return (
                    <div
                      key={booking.id}
                      onClick={() => handleBookingClick(booking)}
                      className={`absolute rounded-2xl p-3 shadow-lg shadow-gray-200/50 border-l-4 transition-all hover:scale-[1.02] cursor-pointer group z-20 ${style.bg} ${style.border}`}
                      style={{
                        top: `${position.timeIndex * 112 + 8}px`,
                        left: `${(position.dayIndex * 14.28) + 0.5}%`,
                        width: '13.28%',
                        height: `${Math.max(position.duration * 112 - 16, 60)}px`
                      }}
                    >
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <p className={`text-xs font-black truncate ${style.text}`}>{booking.user}</p>
                            <span className="material-symbols-outlined text-xs opacity-30 group-hover:opacity-100 transition-opacity">
                              open_in_new
                            </span>
                          </div>
                          <p className={`text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1 ${style.text}`}>
                            {booking.sport} • {booking.court}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`px-2 py-0.5 rounded-[6px] text-[8px] font-black uppercase tracking-widest ${booking.status === 'Confirmed'
                              ? 'bg-white/60 text-emerald-700'
                              : booking.status === 'Pending'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                            {booking.status}
                          </span>
                          <span className={`text-[8px] font-bold opacity-40 uppercase ${style.text}`}>
                            {booking.duration}hr
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Redesigned for full visibility */}
        <div className="xl:col-span-4 flex flex-col min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Sport Legend - inline bar at top */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Legend:</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(sportStyles).map(([name, s]) => (
                <span key={name} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/50">
                  <span className={`size-2 rounded-full ${s.bg} ${s.border} border`}></span>
                  <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{name}</span>
                </span>
              ))}
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
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{booking.user}</p>
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

      {/* Booking Details Modal */}
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
      />

      {/* Date Picker Modal */}
      <DatePicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        initialDate={selectedDate}
        viewMode={viewMode}
      />

      {/* Confirm Dialog */}
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
    </div>
  );
};

export default Bookings;
