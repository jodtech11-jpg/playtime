/**
 * Formatting utility functions
 */

export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    'Active': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    'Pending': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
    'Confirmed': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    'Cancelled': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
    'Completed': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    'Inactive': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' },
    'Expired': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' },
    'Paid': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    'Refunded': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  };

  return statusColors[status] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' };
};

