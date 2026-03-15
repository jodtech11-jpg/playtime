import React from 'react';
import { Booking } from '../../types';
import { formatCurrency, getStatusColor } from '../../utils/formatUtils';
import { formatDate, formatTime } from '../../utils/dateUtils';

interface BookingDetailsModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onAccept?: (bookingId: string) => void;
  onReject?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  booking,
  isOpen,
  onClose,
  onAccept,
  onReject,
  onCancel
}) => {
  if (!isOpen || !booking) return null;

  const statusColors = getStatusColor(booking.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Booking Details</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {booking.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
              {booking.status}
            </span>
            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${
              booking.paymentStatus === 'Paid' 
                ? 'bg-green-50 text-green-700 border-green-100'
                : booking.paymentStatus === 'Pending'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              {booking.paymentStatus}
            </span>
          </div>

          {/* Booking Information */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">User</label>
              <p className="text-base font-bold text-gray-900">{booking.user}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Sport</label>
              <p className="text-base font-bold text-gray-900">{booking.sport}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Court</label>
              <p className="text-base font-bold text-gray-900">{booking.court}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Duration</label>
              <p className="text-base font-bold text-gray-900">{booking.duration} hour{booking.duration > 1 ? 's' : ''}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Date</label>
              <p className="text-base font-bold text-gray-900">{formatDate(booking.startTime)}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Time</label>
              <p className="text-base font-bold text-gray-900">
                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Amount</label>
              <p className="text-2xl font-black text-primary">{formatCurrency(booking.amount)}</p>
            </div>
          </div>

          {/* Team Box (if applicable) */}
          {booking.teamBox && (
            <div className="border-t border-gray-200 pt-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Team Box ({booking.teamBox.type})</label>
              <div className="grid grid-cols-2 gap-3">
                {booking.teamBox.slots.map((slot, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 ${
                      slot.filled
                        ? 'bg-primary/10 border-primary'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">
                        Slot {index + 1}
                      </span>
                      {slot.filled ? (
                        <span className="text-xs font-black text-primary uppercase">Filled</span>
                      ) : (
                        <span className="text-xs font-black text-gray-400 uppercase">Available</span>
                      )}
                    </div>
                    {slot.gender && (
                      <p className="text-xs text-gray-500 mt-1">Gender: {slot.gender}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t border-gray-200 pt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Created</label>
              <p className="text-gray-600">{booking.createdAt ? formatDate(booking.createdAt) : 'N/A'}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Last Updated</label>
              <p className="text-gray-600">{booking.updatedAt ? formatDate(booking.updatedAt) : 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
          {booking.status === 'Pending' && (
            <>
              {onAccept && (
                <button
                  onClick={() => onAccept(booking.id)}
                  className="flex-1 bg-primary text-primary-content py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/10 transition-all"
                >
                  Accept Booking
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(booking.id)}
                  className="flex-1 bg-white border-2 border-red-200 text-red-700 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                >
                  Reject
                </button>
              )}
            </>
          )}
          {booking.status === 'Confirmed' && onCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              className="flex-1 bg-white border-2 border-red-200 text-red-700 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-50 transition-all"
            >
              Cancel Booking
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;

