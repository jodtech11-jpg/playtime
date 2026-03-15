import React, { useState } from 'react';

interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  isOpen,
  onClose,
  onApply,
  initialStartDate,
  initialEndDate,
}) => {
  const [startDate, setStartDate] = useState<string>(() => {
    if (initialStartDate) {
      const date = new Date(initialStartDate);
      return date.toISOString().split('T')[0];
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState<string>(() => {
    if (initialEndDate) {
      const date = new Date(initialEndDate);
      return date.toISOString().split('T')[0];
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const handleApply = () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      alert('Start date must be before end date');
      return;
    }

    onApply(start, end);
    onClose();
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">Select Date Range</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Select Buttons */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block">
              Quick Select
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleQuickSelect(6)}
                className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handleQuickSelect(13)}
                className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Last 14 Days
              </button>
              <button
                onClick={() => handleQuickSelect(29)}
                className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handleQuickSelect(89)}
                className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Last 90 Days
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Selected Range Display */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Selected Range</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {' '}
              {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-6 py-2 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;

