/**
 * Date utility functions for the admin panel
 */

export const formatDate = (date: Date | any): string => {
  if (!date) return '';
  
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatTime = (date: Date | any): string => {
  if (!date) return '';
  
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDateTime = (date: Date | any): string => {
  if (!date) return '';
  return `${formatDate(date)} ${formatTime(date)}`;
};

export const getToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const getTomorrow = (): Date => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

export const getWeekStart = (): Date => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const getWeekEnd = (): Date => {
  const weekEnd = new Date(getWeekStart());
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

export const getMonthStart = (): Date => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
};

export const getMonthEnd = (): Date => {
  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  return monthEnd;
};

export const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getRelativeTime = (date: Date | any): string => {
  if (!date) return '';
  
  const d = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(d);
};

export const isToday = (date: Date | any): boolean => {
  if (!date) return false;
  const d = date.toDate ? date.toDate() : new Date(date);
  const today = getToday();
  return d.toDateString() === today.toDateString();
};

export const isThisWeek = (date: Date | any): boolean => {
  if (!date) return false;
  const d = date.toDate ? date.toDate() : new Date(date);
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();
  return d >= weekStart && d <= weekEnd;
};

export const isThisMonth = (date: Date | any): boolean => {
  if (!date) return false;
  const d = date.toDate ? date.toDate() : new Date(date);
  const monthStart = getMonthStart();
  const monthEnd = getMonthEnd();
  return d >= monthStart && d <= monthEnd;
};

