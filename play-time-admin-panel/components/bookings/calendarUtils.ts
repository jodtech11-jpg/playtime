import { Booking, Venue } from '../../types';

export const calendarDate = (value: any): Date =>
  value?.toDate ? value.toDate() : new Date(value);

export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const sameDay = (a: Date, b: Date): boolean =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

export const getWeekDays = (selectedDate: Date): Date[] => {
  const start = startOfDay(selectedDate);
  const weekday = start.getDay();
  start.setDate(start.getDate() - weekday + (weekday === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export const getMonthDays = (selectedDate: Date): Date[] => {
  const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export interface LaidOutBooking {
  booking: Booking;
  lane: number;
  laneCount: number;
}

export const layoutOverlaps = (bookings: Booking[]): LaidOutBooking[] => {
  const sorted = [...bookings].sort(
    (a, b) => calendarDate(a.startTime).getTime() - calendarDate(b.startTime).getTime()
  );
  const groups: Booking[][] = [];
  let activeGroup: Booking[] = [];
  let groupEnd = -Infinity;

  sorted.forEach((booking) => {
    const start = calendarDate(booking.startTime).getTime();
    const end = calendarDate(booking.endTime).getTime();
    if (activeGroup.length && start >= groupEnd) {
      groups.push(activeGroup);
      activeGroup = [];
      groupEnd = -Infinity;
    }
    activeGroup.push(booking);
    groupEnd = Math.max(groupEnd, end);
  });
  if (activeGroup.length) groups.push(activeGroup);

  return groups.flatMap((group) => {
    const laneEnds: number[] = [];
    const placed = group.map((booking) => {
      const start = calendarDate(booking.startTime).getTime();
      const end = calendarDate(booking.endTime).getTime();
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      return { booking, lane };
    });
    const laneCount = Math.max(laneEnds.length, 1);
    return placed.map((item) => ({ ...item, laneCount }));
  });
};

const parseHour = (value?: string): number | null => {
  if (!value) return null;
  const [hour] = value.split(':').map(Number);
  return Number.isFinite(hour) ? hour : null;
};

export const getCalendarHours = (
  bookings: Booking[],
  venues: Venue[],
  visibleDays: Date[]
): { startHour: number; endHour: number } => {
  const starts: number[] = [];
  const ends: number[] = [];
  const visibleNames = new Set(
    visibleDays.map((day) =>
      day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    )
  );

  venues.forEach((venue) =>
    venue.courts?.forEach((court) =>
      Object.entries(court.availability || {}).forEach(([day, hours]) => {
        if (!visibleNames.has(day.toLowerCase()) || !hours?.available) return;
        const start = parseHour(hours.start);
        const end = parseHour(hours.end);
        if (start != null) starts.push(start);
        if (end != null) ends.push(end);
      })
    )
  );
  bookings.forEach((booking) => {
    if (booking.startTime) starts.push(calendarDate(booking.startTime).getHours());
    if (booking.endTime) {
      const end = calendarDate(booking.endTime);
      ends.push(end.getHours() + (end.getMinutes() > 0 ? 1 : 0));
    }
  });

  return {
    startHour: Math.max(0, starts.length ? Math.min(...starts) : 6),
    endHour: Math.min(24, ends.length ? Math.max(...ends) : 23),
  };
};
