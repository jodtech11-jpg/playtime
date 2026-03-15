import React from 'react';
import { Court } from '../../types';
import { formatCurrency, getStatusColor } from '../../utils/formatUtils';

interface CourtViewModalProps {
  court: Court | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (court: Court) => void;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CourtViewModal: React.FC<CourtViewModalProps> = ({
  court,
  isOpen,
  onClose,
  onEdit
}) => {
  if (!isOpen || !court) return null;

  const statusColors = getStatusColor(court.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            Court Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{court.name}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 font-mono">
                {court.id}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border shrink-0 ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
            >
              {court.status}
            </span>
          </div>

          <div>
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Sport & type</span>
            <p className="text-gray-900 dark:text-white font-bold mt-1">
              {court.sport} {court.type && `• ${court.type}`}
            </p>
          </div>

          <div>
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Price per hour</span>
            <p className="text-lg font-black text-primary mt-1">{formatCurrency(court.pricePerHour)}</p>
          </div>

          {court.availability && Object.keys(court.availability).length > 0 && (
            <div>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Availability</span>
              <div className="mt-3 space-y-2 border border-gray-200 dark:border-slate-600 rounded-xl p-4">
                {DAYS_ORDER.map((day) => {
                  const schedule = court.availability?.[day];
                  if (!schedule) return null;
                  return (
                    <div
                      key={day}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-bold text-gray-700 dark:text-slate-300">{day}</span>
                      {schedule.available ? (
                        <span className="text-gray-900 dark:text-white font-bold">
                          {schedule.start} – {schedule.end}
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(court);
                }}
                className="flex-1 py-3 bg-primary text-primary-content rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover transition-colors"
              >
                Edit Court
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtViewModal;
