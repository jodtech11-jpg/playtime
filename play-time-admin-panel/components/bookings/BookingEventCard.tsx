import React from 'react';
import { Booking, Sport } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { getStatusColor, resolveSportName } from '../../utils/formatUtils';
import { getSportStyle } from '../../utils/sportUtils';

interface BookingEventCardProps {
  booking: Booking;
  sports: Sport[];
  userName: string;
  onClick: () => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const BookingEventCard: React.FC<BookingEventCardProps> = ({
  booking,
  sports,
  userName,
  onClick,
  compact = false,
  className = '',
  style,
}) => {
  const sportName = resolveSportName(booking.sport, sports);
  const sportStyle = getSportStyle(sportName, sports);
  const status = getStatusColor(booking.status);
  const label = `${userName}, ${booking.court}, ${formatTime(booking.startTime)}, ${booking.status}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group overflow-hidden rounded-lg border-l-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      style={{
        backgroundColor: sportStyle.backgroundColor,
        borderLeftColor: sportStyle.borderColor,
        ...style,
      }}
    >
      <div className="flex h-full min-w-0 flex-col justify-between gap-1 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-black" style={{ color: sportStyle.color }}>
            {userName}
          </p>
          {!compact && (
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">
              {booking.court} · {sportName}
            </p>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-between gap-1">
          <span className={`truncate rounded-md border px-1.5 py-0.5 text-xs font-bold ${status.bg} ${status.text} ${status.border}`}>
            {booking.status}
          </span>
          {!compact && (
            <span className="shrink-0 text-xs font-semibold text-slate-500">
              {formatTime(booking.startTime)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default BookingEventCard;
