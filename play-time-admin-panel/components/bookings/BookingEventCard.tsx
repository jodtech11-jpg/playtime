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
  const isCancelled = booking.status === 'Cancelled';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`group overflow-hidden rounded-md border text-left shadow-sm transition hover:z-30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isCancelled ? 'opacity-80' : ''
      } ${className}`}
      style={{
        backgroundColor: sportStyle.backgroundColor,
        borderColor: `${sportStyle.borderColor}55`,
        borderLeftWidth: 4,
        borderLeftColor: isCancelled ? '#ef4444' : sportStyle.borderColor,
        ...style,
      }}
    >
      <div className={`flex h-full min-w-0 flex-col ${compact ? 'justify-center gap-0.5 p-1.5' : 'justify-between gap-1 p-2'}`}>
        <div className="min-w-0">
          <p
            className={`truncate font-black leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`}
            style={{ color: sportStyle.color }}
          >
            {userName}
          </p>
          {compact ? (
            <p className="truncate text-[10px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
              {formatTime(booking.startTime)} · {booking.court || sportName}
            </p>
          ) : (
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              {booking.court} · {sportName}
            </p>
          )}
        </div>
        {!compact && (
          <div className="flex min-w-0 items-center justify-between gap-1">
            <span
              className={`truncate rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${status.bg} ${status.text} ${status.border}`}
            >
              {booking.status}
            </span>
            <span className="shrink-0 text-[10px] font-semibold text-slate-500">
              {formatTime(booking.startTime)}
            </span>
          </div>
        )}
        {compact && (
          <span
            className={`w-fit max-w-full truncate rounded px-1 py-0.5 text-[9px] font-bold leading-none ${status.bg} ${status.text}`}
          >
            {booking.status}
          </span>
        )}
      </div>
    </button>
  );
};

export default BookingEventCard;
