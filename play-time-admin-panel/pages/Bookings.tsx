import React, { useState, useMemo, useEffect } from 'react';
import { useBookings, usePendingBookings } from '../hooks/useBookings';
import { useVenues } from '../hooks/useVenues';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useToast } from '../contexts/ToastContext';
import { bookingsCollection } from '../services/firebase';
import { Booking } from '../types';
import { formatDate, formatTime, getWeekStart, getWeekEnd, getToday } from '../utils/dateUtils';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { exportBookingsToCSV, exportBookingsToPDF } from '../utils/exportUtils';
import BookingDetailsModal from '../components/BookingDetailsModal';
import DatePicker from '../components/DatePicker';
import { serverTimestamp } from 'firebase/firestore';

const Bookings: React.FC = () => {
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { showSuccess, showError } = useToast();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSport, setSelectedSport] = useState<string>('All Sports');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

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

  // Handle booking actions
  const handleAccept = async (bookingId: string) => {
    try {
      setProcessing(bookingId);
      await bookingsCollection.update(bookingId, {
        status: 'Confirmed',
        updatedAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      alert('Failed to accept booking: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (!confirm('Are you sure you want to reject this booking?')) return;

    try {
      setProcessing(bookingId);
      await bookingsCollection.update(bookingId, {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      alert('Failed to reject booking: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      setProcessing(bookingId);
      await bookingsCollection.update(bookingId, {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setSelectedBooking(null);
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking: ' + error.message);
    } finally {
      setProcessing(null);
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
    <div className="p-8 flex flex-col gap-8 h-full bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Header Controls */}
      {/* Header Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
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
              className="size-10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">chevron_right</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
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
                title="Force Reservaton"
              >
                <span className="material-symbols-outlined font-black">add</span>
              </button>

              <div className="relative group">
                <button className="size-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-primary transition-all shadow-sm rounded-xl flex items-center justify-center">
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 overflow-hidden">
        {/* Calendar View */}
        <div className="xl:col-span-8 ui-card flex flex-col overflow-hidden bg-white dark:bg-slate-800">
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
          <div className="flex-1 overflow-y-auto relative bg-white dark:bg-slate-900">
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

        {/* Sidebar */}
        <div className="xl:col-span-4 flex flex-col gap-8">
          {/* Sport Legend */}
          <div className="ui-card p-6 space-y-6">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-4">
              Operational Legend
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(sportStyles).map(([name, s]) => (
                <div key={name} className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all group">
                  <div className={`size-3 rounded-full border-2 ${s.border} ${s.bg} group-hover:scale-125 transition-transform`}></div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests */}
          <div className="ui-card flex flex-col overflow-hidden max-h-[600px]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Queue</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Awaiting verification</p>
              </div>
              {pendingBookings.length > 0 && (
                <span className="bg-amber-400 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-amber-400/20">
                  {pendingBookings.length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {pendingBookings.length > 0 ? (
                pendingBookings.slice(0, 10).map((booking) => {
                  const venue = venues.find(v => v.id === booking.venueId);
                  return (
                    <div
                      key={booking.id}
                      className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handleBookingClick(booking)}
                    >
                      <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">person</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{booking.user}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                              {booking.sport} Specialist
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-5 border-y border-slate-50 dark:border-slate-700/50 py-5 my-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Timeline</span>
                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-200">
                            {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Security ID</span>
                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 font-mono">#{booking.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Facility</span>
                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-200 truncate pr-2">{venue?.name || 'GENERIC'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Revenue Impact</span>
                          <span className="text-[11px] font-black text-primary">{formatCurrency(booking.amount)}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(booking.id);
                          }}
                          disabled={processing === booking.id}
                          className="flex-1 h-11 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(booking.id);
                          }}
                          disabled={processing === booking.id}
                          className="flex-1 h-11 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="size-16 rounded-full bg-emerald-50 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-500 mb-4">
                    <span className="material-symbols-outlined text-3xl">verified</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Clear</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">No pending verifications</p>
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
    </div>
  );
};

export default Bookings;
