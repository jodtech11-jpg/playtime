import React, { useMemo } from 'react';
import { Booking, Sport, Venue } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import BookingEventCard from './BookingEventCard';
import {
  calendarDate,
  getCalendarHours,
  getMonthDays,
  getWeekDays,
  layoutOverlaps,
  sameDay,
} from './calendarUtils';

type ViewMode = 'day' | 'week' | 'month';

interface BookingCalendarProps {
  bookings: Booking[];
  venues: Venue[];
  sports: Sport[];
  selectedDate: Date;
  viewMode: ViewMode;
  selectedVenueId?: string;
  getUserName: (booking: Booking) => string;
  onBookingClick: (booking: Booking) => void;
  onDateClick: (date: Date) => void;
}

interface CalendarColumn {
  id: string;
  label: string;
  sublabel: string;
  bookings: Booking[];
  isToday?: boolean;
}

const SLOT_HEIGHT = 64;

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  venues,
  sports,
  selectedDate,
  viewMode,
  selectedVenueId,
  getUserName,
  onBookingClick,
  onDateClick,
}) => {
  const visibleDays = useMemo(
    () => (viewMode === 'week' ? getWeekDays(selectedDate) : [selectedDate]),
    [selectedDate, viewMode]
  );
  const relevantVenues = useMemo(
    () => (selectedVenueId ? venues.filter((venue) => venue.id === selectedVenueId) : venues),
    [selectedVenueId, venues]
  );
  const { startHour, endHour } = useMemo(
    () => getCalendarHours(bookings, relevantVenues, visibleDays),
    [bookings, relevantVenues, visibleDays]
  );
  const hours = useMemo(
    () => Array.from({ length: Math.max(endHour - startHour, 1) }, (_, index) => startHour + index),
    [startHour, endHour]
  );

  const columns = useMemo<CalendarColumn[]>(() => {
    if (viewMode === 'week') {
      return visibleDays.map((day) => ({
        id: day.toISOString(),
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        sublabel: day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        bookings: bookings.filter((booking) => booking.startTime && sameDay(calendarDate(booking.startTime), day)),
        isToday: sameDay(day, new Date()),
      }));
    }

    const courtMap = new Map<string, { name: string; venueName: string }>();
    relevantVenues.forEach((venue) =>
      venue.courts?.forEach((court) =>
        courtMap.set(court.id, { name: court.name, venueName: venue.name })
      )
    );
    bookings.forEach((booking) => {
      if (!courtMap.has(booking.courtId)) {
        const venueName = venues.find((venue) => venue.id === booking.venueId)?.name || 'Venue';
        courtMap.set(booking.courtId, { name: booking.court || 'Court', venueName });
      }
    });
    return [...courtMap.entries()].map(([courtId, court]) => ({
      id: courtId,
      label: court.name,
      sublabel: court.venueName,
      bookings: bookings.filter(
        (booking) =>
          booking.courtId === courtId &&
          booking.startTime &&
          sameDay(calendarDate(booking.startTime), selectedDate)
      ),
    }));
  }, [bookings, relevantVenues, selectedDate, venues, viewMode, visibleDays]);

  const agendaDays = viewMode === 'month' ? getMonthDays(selectedDate) : visibleDays;
  const agendaBookings = bookings
    .filter((booking) => booking.startTime && agendaDays.some((day) => sameDay(calendarDate(booking.startTime), day)))
    .sort((a, b) => calendarDate(a.startTime).getTime() - calendarDate(b.startTime).getTime());

  return (
    <section className="ui-card min-h-0 overflow-hidden bg-white dark:bg-slate-800" aria-label="Booking calendar">
      <div className="md:hidden">
        <AgendaList
          bookings={agendaBookings}
          getUserName={getUserName}
          onBookingClick={onBookingClick}
        />
      </div>
      <div className="hidden h-full min-h-[560px] md:block">
        {viewMode === 'month' ? (
          <MonthGrid
            bookings={bookings}
            selectedDate={selectedDate}
            getUserName={getUserName}
            onBookingClick={onBookingClick}
            onDateClick={onDateClick}
          />
        ) : (
          <TimeGrid
            columns={columns}
            hours={hours}
            startHour={startHour}
            sports={sports}
            getUserName={getUserName}
            onBookingClick={onBookingClick}
          />
        )}
      </div>
    </section>
  );
};

const TimeGrid: React.FC<{
  columns: CalendarColumn[];
  hours: number[];
  startHour: number;
  sports: Sport[];
  getUserName: (booking: Booking) => string;
  onBookingClick: (booking: Booking) => void;
}> = ({ columns, hours, startHour, sports, getUserName, onBookingClick }) => {
  const safeColumns = columns.length
    ? columns
    : [{ id: 'empty', label: 'No courts', sublabel: 'Select a venue', bookings: [] }];
  const gridTemplateColumns = `72px repeat(${safeColumns.length}, minmax(150px, 1fr))`;
  const bodyHeight = Math.max(hours.length * SLOT_HEIGHT, 480);

  return (
    <div className="h-full max-h-[72vh] overflow-auto scrollbar-visible">
      <div className="min-w-max" style={{ width: `max(100%, ${72 + safeColumns.length * 150}px)` }}>
        <div
          className="sticky top-0 z-40 grid border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          style={{ gridTemplateColumns }}
          role="row"
        >
          <div className="sticky left-0 z-50 flex h-16 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            Time
          </div>
          {safeColumns.map((column) => (
            <div
              key={column.id}
              role="columnheader"
              className={`flex h-16 min-w-0 flex-col items-center justify-center border-r border-slate-100 px-2 text-center dark:border-slate-700 ${column.isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
            >
              <span className={`text-xs font-black uppercase ${column.isToday ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                {column.label}
              </span>
              <span className="mt-1 max-w-full truncate text-xs font-semibold text-slate-400">
                {column.sublabel}
              </span>
            </div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns }} role="grid">
          <div className="sticky left-0 z-30 border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900" style={{ height: bodyHeight }}>
            {hours.map((hour) => (
              <div key={hour} className="border-b border-slate-200 px-2 pt-2 text-right text-xs font-bold text-slate-400 dark:border-slate-800" style={{ height: SLOT_HEIGHT }}>
                {new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric' })}
              </div>
            ))}
          </div>
          {safeColumns.map((column) => (
            <div
              key={column.id}
              className="relative border-r border-slate-100 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_63px,rgba(148,163,184,0.18)_64px)] dark:border-slate-700"
              style={{ height: bodyHeight }}
              role="gridcell"
            >
              {layoutOverlaps(column.bookings).map(({ booking, lane, laneCount }) => {
                const start = calendarDate(booking.startTime);
                const end = calendarDate(booking.endTime);
                const top = ((start.getHours() + start.getMinutes() / 60) - startHour) * SLOT_HEIGHT + 3;
                const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * SLOT_HEIGHT - 6, 42);
                const width = 100 / laneCount;
                return (
                  <BookingEventCard
                    key={booking.id}
                    booking={booking}
                    sports={sports}
                    userName={getUserName(booking)}
                    onClick={() => onBookingClick(booking)}
                    compact={height < 64 || laneCount > 1}
                    className="absolute z-10"
                    style={{
                      top,
                      height,
                      left: `calc(${lane * width}% + 3px)`,
                      width: `calc(${width}% - 6px)`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MonthGrid: React.FC<{
  bookings: Booking[];
  selectedDate: Date;
  getUserName: (booking: Booking) => string;
  onBookingClick: (booking: Booking) => void;
  onDateClick: (date: Date) => void;
}> = ({ bookings, selectedDate, getUserName, onBookingClick, onDateClick }) => {
  const days = getMonthDays(selectedDate);
  return (
    <div className="p-4">
      <div className="grid grid-cols-7 border-l border-t border-slate-200 dark:border-slate-700">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-xs font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dayBookings = bookings
            .filter((booking) => booking.startTime && sameDay(calendarDate(booking.startTime), day))
            .sort((a, b) => calendarDate(a.startTime).getTime() - calendarDate(b.startTime).getTime());
          const inMonth = day.getMonth() === selectedDate.getMonth();
          return (
            <div key={day.toISOString()} className={`min-h-28 border-b border-r border-slate-200 p-2 dark:border-slate-700 ${inMonth ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/70 dark:bg-slate-900/60'}`}>
              <button
                type="button"
                onClick={() => onDateClick(day)}
                className={`mb-1 flex size-7 items-center justify-center rounded-full text-xs font-black focus-visible:ring-2 focus-visible:ring-primary ${sameDay(day, new Date()) ? 'bg-primary text-white' : inMonth ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}
                aria-label={`Open ${day.toDateString()} day view`}
              >
                {day.getDate()}
              </button>
              <div className="space-y-1">
                {dayBookings.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onBookingClick(booking)}
                    className="block w-full truncate rounded bg-slate-100 px-1.5 py-1 text-left text-xs font-semibold text-slate-700 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-700 dark:text-slate-200"
                  >
                    {formatTime(booking.startTime)} {getUserName(booking)}
                  </button>
                ))}
                {dayBookings.length > 3 && (
                  <button type="button" onClick={() => onDateClick(day)} className="text-xs font-bold text-primary">
                    +{dayBookings.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AgendaList: React.FC<{
  bookings: Booking[];
  getUserName: (booking: Booking) => string;
  onBookingClick: (booking: Booking) => void;
}> = ({ bookings, getUserName, onBookingClick }) => (
  <div className="max-h-[65vh] overflow-y-auto p-3">
    {bookings.length ? (
      <ul className="space-y-2">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <button
              type="button"
              onClick={() => onBookingClick(booking)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{getUserName(booking)}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{booking.court} · {booking.status}</p>
              </div>
              <div className="shrink-0 text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                <p>{calendarDate(booking.startTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
                <p>{formatTime(booking.startTime)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <div className="py-16 text-center text-sm font-semibold text-slate-400">No bookings in this period</div>
    )}
  </div>
);

export default BookingCalendar;
