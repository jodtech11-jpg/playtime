import React, { useState, useMemo } from 'react';
import { formatDate, getToday } from '../../utils/dateUtils';

interface DatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  initialDate?: Date;
  viewMode?: 'day' | 'week' | 'month';
}

const DatePicker: React.FC<DatePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialDate,
  viewMode = 'day',
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = initialDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }> = [];

    // Previous month's days
    const prevMonth = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.toDateString() === getToday().toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
      });
    }

    // Current month's days
    const today = getToday();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
      });
    }

    // Next month's days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.toDateString() === getToday().toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
      });
    }

    return days;
  }, [currentMonth, selectedDate]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onSelect(date);
    onClose();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = getToday();
    setSelectedDate(today);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleQuickSelect = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setSelectedDate(date);
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">Select Date</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Quick Select Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleQuickSelect(-1)}
              className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Yesterday
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => handleQuickSelect(1)}
              className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Tomorrow
            </button>
            <button
              onClick={() => handleQuickSelect(7)}
              className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Next Week
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-gray-600">chevron_left</span>
            </button>
            <h4 className="text-base font-black text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h4>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-gray-600">chevron_right</span>
            </button>
          </div>

          {/* Calendar Grid */}
          <div>
            {/* Week Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-black text-gray-400 uppercase tracking-widest py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDateClick(day.date)}
                  className={`
                    aspect-square rounded-lg text-sm font-bold transition-all
                    ${day.isSelected
                      ? 'bg-primary text-primary-content shadow-lg'
                      : day.isToday
                      ? 'bg-primary/10 text-primary border-2 border-primary'
                      : day.isCurrentMonth
                      ? 'text-gray-900 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Date Display */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Selected Date</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(selectedDate)}
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
            onClick={() => {
              onSelect(selectedDate);
              onClose();
            }}
            className="px-6 py-2 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePicker;

