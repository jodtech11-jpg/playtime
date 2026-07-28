import { Booking, Venue } from '../../types';

export const calendarDate = (value: any): Date => {
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

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

/** Side-by-side lanes stay readable; extras go into "+N more". */
export const MAX_VISIBLE_LANES = 2;

export interface LaidOutBooking {
  booking: Booking;
  lane: number;
  laneCount: number;
}

export interface LayoutOverflow {
  id: string;
  startMs: number;
  endMs: number;
  bookings: Booking[];
}

export interface OverlapLayout {
  items: LaidOutBooking[];
  overflows: LayoutOverflow[];
}

const bookingInterval = (booking: Booking): { start: number; end: number } => {
  const start = calendarDate(booking.startTime).getTime();
  let end = calendarDate(booking.endTime).getTime();
  if (!Number.isFinite(start)) {
    const fallback = Date.now();
    return { start: fallback, end: fallback + 3600000 };
  }
  if (!Number.isFinite(end) || end <= start) {
    end = start + 3600000;
  }
  return { start, end };
};

export const layoutOverlaps = (
  bookings: Booking[],
  maxVisibleLanes: number = MAX_VISIBLE_LANES
): OverlapLayout => {
  const sorted = [...bookings].sort(
    (a, b) => bookingInterval(a).start - bookingInterval(b).start
  );
  const groups: Booking[][] = [];
  let activeGroup: Booking[] = [];
  let groupEnd = -Infinity;

  sorted.forEach((booking) => {
    const { start, end } = bookingInterval(booking);
    if (activeGroup.length && start >= groupEnd) {
      groups.push(activeGroup);
      activeGroup = [];
      groupEnd = -Infinity;
    }
    activeGroup.push(booking);
    groupEnd = Math.max(groupEnd, end);
  });
  if (activeGroup.length) groups.push(activeGroup);

  const items: LaidOutBooking[] = [];
  const overflows: LayoutOverflow[] = [];

  groups.forEach((group, groupIndex) => {
    const laneEnds: number[] = [];
    const placed = group.map((booking) => {
      const { start, end } = bookingInterval(booking);
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      return { booking, lane, start, end };
    });

    const totalLanes = Math.max(laneEnds.length, 1);
    const visibleLaneCount = Math.min(totalLanes, Math.max(maxVisibleLanes, 1));
    const hasOverflow = totalLanes > visibleLaneCount;
    const displayLaneCount = visibleLaneCount + (hasOverflow ? 1 : 0);

    const hidden = placed.filter((item) => item.lane >= visibleLaneCount);
    placed
      .filter((item) => item.lane < visibleLaneCount)
      .forEach(({ booking, lane }) => {
        items.push({ booking, lane, laneCount: displayLaneCount });
      });

    if (hasOverflow && hidden.length) {
      const overflowStart = Math.min(...hidden.map((item) => item.start));
      const overflowEnd = Math.max(...hidden.map((item) => item.end));
      overflows.push({
        id: `overflow-${groupIndex}-${overflowStart}`,
        startMs: overflowStart,
        endMs: overflowEnd,
        bookings: hidden.map((item) => item.booking),
      });
    }
  });

  return { items, overflows };
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
      if (!Number.isNaN(end.getTime())) {
        ends.push(end.getHours() + (end.getMinutes() > 0 ? 1 : 0));
      }
    }
  });

  return {
    startHour: Math.max(0, starts.length ? Math.min(...starts) : 6),
    endHour: Math.min(24, ends.length ? Math.max(...ends) : 23),
  };
};
