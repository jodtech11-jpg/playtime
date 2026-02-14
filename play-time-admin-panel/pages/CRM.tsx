import React, { useState, useMemo } from 'react';
import { useBookings } from '../hooks/useBookings';
import { useVenues } from '../hooks/useVenues';
import { useFinancials } from '../hooks/useFinancials';
import { useUsers } from '../hooks/useUsers';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { usePayments } from '../hooks/usePayments';
import { useMemberships } from '../hooks/useMemberships';
import { useToast } from '../contexts/ToastContext';
import { venuesCollection, usersCollection } from '../services/firebase';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatUtils';
import { getRelativeTime, getToday, getWeekStart, getWeekEnd, getMonthStart, getMonthEnd, formatDate } from '../utils/dateUtils';
import { exportBookingsToPDF, exportUsersToCSV } from '../utils/exportUtils';
import DateRangePicker from '../components/DateRangePicker';
import { serverTimestamp } from 'firebase/firestore';
// Chart imports available for future enhancements
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const CRM: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);
  const [dateRangeType, setDateRangeType] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'reports' | 'support'>('overview');

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const today = getToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (dateRangeType) {
      case 'today':
        return { start: today, end: tomorrow };
      case 'week':
        return { start: getWeekStart(), end: getWeekEnd() };
      case 'month':
        return { start: getMonthStart(), end: getMonthEnd() };
      case 'custom':
        if (customDateRange) {
          return customDateRange;
        }
        return { start: getMonthStart(), end: getMonthEnd() };
      default:
        return { start: getMonthStart(), end: getMonthEnd() };
    }
  }, [dateRangeType, customDateRange]);

  // Fetch data with date range
  const { bookings } = useBookings({ dateRange, realtime: true });
  const { venues, loading: venuesLoading } = useVenues({ realtime: true });
  const { metrics, transactions } = useFinancials({ realtime: true });
  const { users } = useUsers({ limit: 1000 });
  const { tickets: supportTickets } = useSupportTickets({ realtime: true });
  const { payments } = usePayments({ realtime: true });
  const { memberships } = useMemberships({ realtime: true });

  // Calculate previous period for comparison
  const previousPeriod = useMemo(() => {
    const periodDays = dateRangeType === 'today' ? 1 : dateRangeType === 'week' ? 7 : 30;
    const start = new Date(dateRange.start);
    start.setDate(start.getDate() - periodDays);
    const end = new Date(dateRange.end);
    end.setDate(end.getDate() - periodDays);
    return { start, end };
  }, [dateRange, dateRangeType]);

  // Get previous period bookings for comparison
  const { bookings: previousBookings } = useBookings({ dateRange: previousPeriod, realtime: false });

  // Calculate CRM statistics with real trends
  const crmStats = useMemo(() => {
    const periodBookings = bookings.filter(b => {
      const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
      return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
    });
    
    const confirmedBookings = periodBookings.filter(b => b.status === 'Confirmed' || b.status === 'Completed');
    const totalBookings = confirmedBookings.length;
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    
    const prevPeriodBookings = previousBookings.filter(b => {
      const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
      return bookingDate >= previousPeriod.start && bookingDate <= previousPeriod.end;
    });
    const prevConfirmed = prevPeriodBookings.filter(b => b.status === 'Confirmed' || b.status === 'Completed');
    const prevTotalBookings = prevConfirmed.length;
    const prevTotalRevenue = prevConfirmed.reduce((sum, b) => sum + (b.amount || 0), 0);

    // Calculate trends
    const bookingsTrend = prevTotalBookings > 0 
      ? ((totalBookings - prevTotalBookings) / prevTotalBookings) * 100 
      : totalBookings > 0 ? 100 : 0;
    const revenueTrend = prevTotalRevenue > 0 
      ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 
      : totalRevenue > 0 ? 100 : 0;

    const activeVenues = venues.filter(v => v.status === 'Active').length;
    const pendingVenues = venues.filter(v => v.status === 'Pending').length;
    
    // Calculate open disputes from support tickets
    const openDisputes = supportTickets.filter(t => 
      (t.status === 'Open' || t.status === 'In Progress') && 
      (t.type === 'Refund Request' || t.priority === 'Critical' || t.priority === 'High')
    ).length;
    
    const criticalDisputes = supportTickets.filter(t => 
      (t.status === 'Open' || t.status === 'In Progress') && t.priority === 'Critical'
    ).length;

    return {
      totalBookings: totalBookings.toLocaleString(),
      totalRevenue: formatCurrency(totalRevenue),
      activeVenues: activeVenues.toString(),
      openDisputes: openDisputes.toString(),
      revenueTrend: Math.round(revenueTrend * 10) / 10,
      bookingsTrend: Math.round(bookingsTrend * 10) / 10,
      pendingVenues,
      criticalDisputes
    };
  }, [bookings, previousBookings, metrics, venues, supportTickets, dateRange, previousPeriod]);

  // Get pending approvals (venues with Pending status)
  const pendingApprovals = useMemo(() => {
    return venues
      .filter(v => v.status === 'Pending')
      .map(venue => {
        const manager = users.find(u => u.id === venue.managerId);
        const sports = venue.sports?.join(', ') || 'N/A';
        const createdAt = venue.createdAt?.toDate ? venue.createdAt.toDate() : new Date(venue.createdAt);
        
        return {
          ...venue,
          managerName: manager?.name || 'Unknown',
          sportsText: sports,
          timeAgo: getRelativeTime(createdAt),
          imageUrl: venue.images && venue.images.length > 0 
            ? venue.images[0] 
            : `https://picsum.photos/id/${Math.floor(Math.random() * 100) + 50}/100/100`
        };
      });
  }, [venues, users]);

  // Calculate revenue by month (last 6 months) with real data
  const revenueByMonth = useMemo(() => {
    const months: { month: string; revenue: number; bookings: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      const monthBookings = bookings.filter(b => {
        const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
        return bookingDate >= monthStart && bookingDate <= monthEnd && 
               (b.status === 'Confirmed' || b.status === 'Completed');
      });
      
      const monthRevenue = monthBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
      
      months.push({
        month: date.toLocaleString('default', { month: 'short' }),
        revenue: monthRevenue,
        bookings: monthBookings.length
      });
    }
    
    const maxRevenue = Math.max(...months.map(m => m.revenue), 1);
    
    return months.map(m => ({
      ...m,
      percentage: Math.round((m.revenue / maxRevenue) * 100)
    }));
  }, [bookings]);
  
  // Revenue by sport category
  const revenueBySport = useMemo(() => {
    const periodBookings = bookings.filter(b => {
      const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
      return bookingDate >= dateRange.start && bookingDate <= dateRange.end && 
             (b.status === 'Confirmed' || b.status === 'Completed');
    });
    
    const sportMap = new Map<string, number>();
    periodBookings.forEach(b => {
      const sport = b.sport || 'Unknown';
      sportMap.set(sport, (sportMap.get(sport) || 0) + (b.amount || 0));
    });
    
    return Array.from(sportMap.entries())
      .map(([sport, revenue]) => ({ sport, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings, dateRange]);

  const handleApproveVenue = async (venueId: string) => {
    try {
      setProcessing(venueId);
      await venuesCollection.update(venueId, {
        status: 'Active',
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error approving venue:', error);
      alert('Failed to approve venue: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectVenue = async (venueId: string) => {
    if (!confirm('Are you sure you want to reject this venue?')) return;

    try {
      setProcessing(venueId);
      await venuesCollection.update(venueId, {
        status: 'Inactive',
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error rejecting venue:', error);
      alert('Failed to reject venue: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  if (venuesLoading && venues.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading CRM data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-background-light">
      <div className="max-w-[1400px] mx-auto space-y-10">
        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: 'dashboard' },
            { id: 'customers', label: 'Customers', icon: 'people' },
            { id: 'reports', label: 'Reports', icon: 'assessment' },
            { id: 'support', label: 'Support & Disputes', icon: 'support_agent' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'customers' && 'Customer Insights'}
              {activeTab === 'reports' && 'Reports & Analytics'}
              {activeTab === 'support' && 'Support & Disputes'}
            </h3>
            <p className="text-gray-500 font-medium">
              {activeTab === 'overview' && 'Platform performance, onboarding queues, and administrative tasks.'}
              {activeTab === 'customers' && 'Customer segmentation, lifetime value, and engagement metrics.'}
              {activeTab === 'reports' && 'Comprehensive reports and analytics for business insights.'}
              {activeTab === 'support' && 'Support tickets, disputes, and customer service metrics.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl p-1">
              {(['today', 'week', 'month', 'custom'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    if (type === 'custom') {
                      setShowDatePicker(true);
                    } else {
                      setDateRangeType(type);
                    }
                  }}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    dateRangeType === type
                      ? 'bg-primary text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {type === 'today' ? 'Today' : type === 'week' ? 'Week' : type === 'month' ? 'Month' : 'Custom'}
                </button>
              ))}
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300 shadow-sm hover:shadow-lg transition-all">
                <span className="material-symbols-outlined text-[18px]">download</span> Export Report
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[200px]">
                <button
                  onClick={() => {
                    try {
                      const periodBookings = bookings.filter(b => {
                        const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
                        return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
                      });
                      exportBookingsToPDF(periodBookings, `CRM Bookings Report - ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`, venues);
                      showSuccess('Bookings report exported to PDF successfully!');
                    } catch (error: any) {
                      showError('Failed to export PDF. Please try again.');
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-t-xl flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                  Bookings Report (PDF)
                </button>
                <button
                  onClick={() => {
                    try {
                      exportUsersToCSV(users);
                      showSuccess('Users exported to CSV successfully!');
                    } catch (error: any) {
                      showError('Failed to export CSV. Please try again.');
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">description</span>
                  Users List (CSV)
                </button>
                <button
                  onClick={() => {
                    try {
                      // Export financial report as CSV
                      const csvContent = [
                        ['Metric', 'Value'],
                        ['Total Revenue', formatCurrency(crmStats.totalRevenue)],
                        ['Total Bookings', crmStats.totalBookings],
                        ['Active Venues', crmStats.activeVenues],
                        ['Open Disputes', crmStats.openDisputes],
                        ['Period', `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`]
                      ].map(row => row.join(',')).join('\n');
                      
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `CRM_Financial_Report_${formatDate(dateRange.start)}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                      showSuccess('Financial report exported to CSV successfully!');
                    } catch (error: any) {
                      showError('Failed to export CSV. Please try again.');
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-b-xl flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">table_chart</span>
                  Financial Report (CSV)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  label: "Total Bookings", 
                  val: crmStats.totalBookings, 
                  change: `${crmStats.bookingsTrend >= 0 ? '+' : ''}${crmStats.bookingsTrend.toFixed(1)}%`, 
                  trend: crmStats.bookingsTrend >= 0 ? "up" : "down", 
                  icon: "book_online", 
                  color: "text-primary", 
                  bg: "bg-green-50" 
                },
                { 
                  label: "Total Revenue", 
                  val: crmStats.totalRevenue, 
                  change: `${crmStats.revenueTrend >= 0 ? '+' : ''}${crmStats.revenueTrend.toFixed(1)}%`, 
                  trend: crmStats.revenueTrend >= 0 ? "up" : "down", 
                  icon: "payments", 
                  color: "text-blue-500", 
                  bg: "bg-blue-50" 
                },
                { 
                  label: "Active Venues", 
                  val: crmStats.activeVenues, 
                  change: crmStats.pendingVenues > 0 ? `${crmStats.pendingVenues} New` : "0 New", 
                  trend: "up", 
                  icon: "location_city", 
                  color: "text-orange-500", 
                  bg: "bg-orange-50" 
                },
                { 
                  label: "Open Disputes", 
                  val: crmStats.openDisputes, 
                  change: crmStats.criticalDisputes > 0 ? `${crmStats.criticalDisputes} Critical` : "0 Critical", 
                  trend: crmStats.openDisputes > 0 ? "down" : "up", 
                  icon: "gavel", 
                  color: "text-red-500", 
                  bg: "bg-red-50" 
                },
              ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-surface-dark rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group h-36 flex flex-col justify-between">
              <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className={`material-symbols-outlined text-7xl ${s.color}`}>{s.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{s.label}</p>
                <h4 className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1 tracking-tight">{s.val}</h4>
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${s.trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
                <span className="material-symbols-outlined text-sm">{s.trend === 'up' ? 'trending_up' : 'warning'}</span>
                {s.change}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 space-y-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">Revenue Analytics</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Monthly breakdown by sport category</p>
              </div>
              <select className="bg-gray-50 border-none text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-2 focus:ring-1 focus:ring-primary text-gray-700 shadow-inner">
                <option>Last 6 Months</option>
              </select>
            </div>
            <div className="space-y-6">
              {/* Monthly Revenue Chart */}
              <div className="h-64 flex items-end justify-between gap-4 w-full pt-4">
                {revenueByMonth.map((month, i) => (
                  <div key={month.month} className="flex flex-col items-center gap-3 flex-1 group">
                    <div className="w-full bg-gray-50 rounded-2xl relative h-full flex items-end overflow-hidden shadow-inner border border-gray-100/50 min-h-[40px]">
                      <div 
                        className="w-full bg-primary/80 group-hover:bg-primary transition-all duration-700 shadow-lg rounded-t-2xl" 
                        style={{ height: `${month.percentage}%` }}
                        title={`${formatCurrency(month.revenue)} - ${month.bookings} bookings`}
                      ></div>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">{month.month}</span>
                      <span className="text-[9px] font-bold text-gray-500">{formatCurrency(month.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Revenue by Sport */}
              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Revenue by Sport</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {revenueBySport.slice(0, 8).map((item, i) => {
                    const totalRevenue = revenueBySport.reduce((sum, s) => sum + s.revenue, 0);
                    const percentage = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
                    return (
                      <div key={item.sport} className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.sport}</p>
                        <p className="text-sm font-black text-gray-900">{formatCurrency(item.revenue)}</p>
                        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-1">{percentage.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
                <span className="material-symbols-outlined text-orange-500">pending_actions</span>
                Approvals
              </h3>
              {pendingApprovals.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  {pendingApprovals.length} Pending
                </span>
              )}
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto pr-2 no-scrollbar">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">check_circle</span>
                  <p className="text-sm font-medium">No pending approvals</p>
                </div>
              ) : (
                pendingApprovals.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col gap-4 group hover:bg-gray-50 transition-colors shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className="size-11 rounded-xl bg-cover bg-center border border-gray-200" 
                          style={{ backgroundImage: `url(${item.imageUrl})` }}
                        ></div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{item.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            New Venue • {item.sportsText}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{item.timeAgo}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectVenue(item.id)}
                        disabled={processing === item.id}
                        className="flex-1 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveVenue(item.id)}
                        disabled={processing === item.id}
                        className="flex-1 py-2 bg-primary text-primary-content rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-100 transition-colors disabled:opacity-50"
                      >
                        {processing === item.id ? 'Processing...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {/* Customer Insights Tab */}
        {activeTab === 'customers' && (
          <CustomerInsightsSection 
            bookings={bookings}
            users={users}
            memberships={memberships}
            dateRange={dateRange}
          />
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <ReportsSection 
            bookings={bookings}
            users={users}
            venues={venues}
            payments={payments}
            transactions={transactions}
            metrics={metrics}
            dateRange={dateRange}
            onExport={showSuccess}
          />
        )}

        {/* Support & Disputes Tab */}
        {activeTab === 'support' && (
          <SupportSection 
            tickets={supportTickets}
            bookings={bookings}
            users={users}
          />
        )}
      </div>

      {/* Date Range Picker Modal */}
      <DateRangePicker
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onApply={(start, end) => {
          setCustomDateRange({ start, end });
          setDateRangeType('custom');
        }}
        initialStartDate={customDateRange?.start}
        initialEndDate={customDateRange?.end}
      />
    </div>
  );
};

// Customer Insights Section Component
const CustomerInsightsSection: React.FC<{
  bookings: any[];
  users: any[];
  memberships: any[];
  dateRange: { start: Date; end: Date };
}> = ({ bookings, users, memberships, dateRange }) => {
  // Calculate top customers by revenue
  const topCustomers = useMemo(() => {
    const customerMap = new Map<string, { user: any; revenue: number; bookings: number; lastBooking: Date | null }>();
    
    bookings
      .filter(b => {
        const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
        return bookingDate >= dateRange.start && bookingDate <= dateRange.end && 
               (b.status === 'Confirmed' || b.status === 'Completed');
      })
      .forEach(booking => {
        const userId = booking.userId;
        const user = users.find(u => u.id === userId);
        if (!user) return;
        
        const existing = customerMap.get(userId) || { user, revenue: 0, bookings: 0, lastBooking: null };
        existing.revenue += booking.amount || 0;
        existing.bookings += 1;
        const bookingDate = booking.startTime?.toDate ? booking.startTime.toDate() : new Date(booking.date);
        if (!existing.lastBooking || bookingDate > existing.lastBooking) {
          existing.lastBooking = bookingDate;
        }
        customerMap.set(userId, existing);
      });
    
    return Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [bookings, users, dateRange]);

  // Customer segmentation
  const customerSegments = useMemo(() => {
    const activeUsers = new Set(bookings
      .filter(b => {
        const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
        return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
      })
      .map(b => b.userId)
    );
    
    const members = new Set(memberships.map(m => m.userId));
    
    return {
      total: users.length,
      active: activeUsers.size,
      members: members.size,
      inactive: users.length - activeUsers.size
    };
  }, [users, bookings, memberships, dateRange]);

  // Customer lifetime value calculation
  const avgCustomerValue = useMemo(() => {
    if (topCustomers.length === 0) return 0;
    const totalRevenue = topCustomers.reduce((sum, c) => sum + c.revenue, 0);
    return totalRevenue / topCustomers.length;
  }, [topCustomers]);

  return (
    <div className="space-y-8">
      {/* Customer Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Customers', value: customerSegments.total.toLocaleString(), icon: 'people', color: 'text-blue-500' },
          { label: 'Active Customers', value: customerSegments.active.toLocaleString(), icon: 'person_check', color: 'text-green-500' },
          { label: 'Members', value: customerSegments.members.toLocaleString(), icon: 'card_membership', color: 'text-purple-500' },
          { label: 'Avg. Customer Value', value: formatCurrency(avgCustomerValue), icon: 'trending_up', color: 'text-orange-500' }
        ].map((metric, i) => (
          <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900">{metric.value}</h3>
              <span className={`material-symbols-outlined ${metric.color} text-3xl`}>{metric.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Top Customers</h3>
        <div className="space-y-4">
          {topCustomers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <span className="material-symbols-outlined text-5xl mb-3 block">person_off</span>
              <p className="text-sm font-medium">No customer data for this period</p>
            </div>
          ) : (
            topCustomers.map((customer, index) => (
              <div key={customer.user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-black text-primary">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{customer.user.name || 'Unknown User'}</p>
                    <p className="text-xs text-gray-500">{customer.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Revenue</p>
                    <p className="text-sm font-black text-gray-900">{formatCurrency(customer.revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bookings</p>
                    <p className="text-sm font-black text-gray-900">{customer.bookings}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Reports Section Component
const ReportsSection: React.FC<{
  bookings: any[];
  users: any[];
  venues: any[];
  payments: any[];
  transactions: any[];
  metrics: any;
  dateRange: { start: Date; end: Date };
  onExport: (message: string) => void;
}> = ({ bookings, users, venues, payments, transactions, metrics, dateRange, onExport }) => {
  const [selectedReport, setSelectedReport] = useState<'financial' | 'booking' | 'user' | 'venue'>('financial');

  // Financial Report Data
  const financialData = useMemo(() => {
    const periodBookings = bookings.filter(b => {
      const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
      return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
    });
    
    const confirmedBookings = periodBookings.filter(b => b.status === 'Confirmed' || b.status === 'Completed');
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const platformCommission = totalRevenue * 0.05; // 5% commission
    const convenienceFees = confirmedBookings.filter(b => b.isFirstTimeBooking).length * 100;
    
    return {
      totalRevenue,
      platformCommission,
      convenienceFees,
      netRevenue: totalRevenue - platformCommission,
      totalBookings: confirmedBookings.length,
      averageBookingValue: confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0
    };
  }, [bookings, dateRange]);

  return (
    <div className="space-y-8">
      {/* Report Type Selector */}
      <div className="flex items-center gap-3 bg-white rounded-2xl p-2 border border-gray-100">
        {[
          { id: 'financial', label: 'Financial', icon: 'payments' },
          { id: 'booking', label: 'Bookings', icon: 'book_online' },
          { id: 'user', label: 'Users', icon: 'people' },
          { id: 'venue', label: 'Venues', icon: 'location_city' }
        ].map(report => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
              selectedReport === report.id
                ? 'bg-primary text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{report.icon}</span>
            {report.label}
          </button>
        ))}
      </div>

      {/* Financial Report */}
      {selectedReport === 'financial' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Financial Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Total Revenue', value: formatCurrency(financialData.totalRevenue), icon: 'trending_up', color: 'text-green-600' },
              { label: 'Platform Commission', value: formatCurrency(financialData.platformCommission), icon: 'percent', color: 'text-blue-600' },
              { label: 'Convenience Fees', value: formatCurrency(financialData.convenienceFees), icon: 'attach_money', color: 'text-orange-600' },
              { label: 'Net Revenue', value: formatCurrency(financialData.netRevenue), icon: 'account_balance', color: 'text-purple-600' },
              { label: 'Total Bookings', value: financialData.totalBookings.toLocaleString(), icon: 'book_online', color: 'text-primary' },
              { label: 'Avg Booking Value', value: formatCurrency(financialData.averageBookingValue), icon: 'analytics', color: 'text-indigo-600' }
            ].map((metric, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-black text-gray-900">{metric.value}</p>
                  <span className={`material-symbols-outlined ${metric.color} text-2xl`}>{metric.icon}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking Report */}
      {selectedReport === 'booking' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Booking Report</h3>
          
          {/* Booking Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {(() => {
              const periodBookings = bookings.filter(b => {
                const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
                return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
              });
              const confirmed = periodBookings.filter(b => b.status === 'Confirmed' || b.status === 'Completed');
              const cancelled = periodBookings.filter(b => b.status === 'Cancelled');
              const pending = periodBookings.filter(b => b.status === 'Pending');
              const totalRevenue = confirmed.reduce((sum, b) => sum + (b.amount || 0), 0);
              
              return [
                { label: 'Total Bookings', value: periodBookings.length.toLocaleString(), icon: 'book_online', color: 'text-blue-500' },
                { label: 'Confirmed', value: confirmed.length.toLocaleString(), icon: 'check_circle', color: 'text-green-500' },
                { label: 'Cancelled', value: cancelled.length.toLocaleString(), icon: 'cancel', color: 'text-red-500' },
                { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: 'payments', color: 'text-purple-500' }
              ].map((metric, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-black text-gray-900">{metric.value}</p>
                    <span className={`material-symbols-outlined ${metric.color} text-2xl`}>{metric.icon}</span>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Bookings by Sport */}
          <div>
            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-4">Bookings by Sport</h4>
            <div className="space-y-3">
              {(() => {
                const periodBookings = bookings.filter(b => {
                  const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
                  return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
                });
                const sportMap = new Map<string, { count: number; revenue: number }>();
                periodBookings.forEach(b => {
                  const sport = b.sport || 'Unknown';
                  const existing = sportMap.get(sport) || { count: 0, revenue: 0 };
                  existing.count += 1;
                  existing.revenue += b.amount || 0;
                  sportMap.set(sport, existing);
                });
                return Array.from(sportMap.entries())
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([sport, data]) => (
                    <div key={sport} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-black text-gray-900">{sport}</p>
                        <p className="text-xs text-gray-500">{data.count} bookings</p>
                      </div>
                      <p className="text-sm font-black text-gray-900">{formatCurrency(data.revenue)}</p>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* User Report */}
      {selectedReport === 'user' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">User Report</h3>
          
          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {(() => {
              const activeUsers = new Set(bookings
                .filter(b => {
                  const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
                  return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
                })
                .map(b => b.userId)
              );
              const newUsers = users.filter(u => {
                const created = u.createdAt?.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                return created >= dateRange.start && created <= dateRange.end;
              });
              
              return [
                { label: 'Total Users', value: users.length.toLocaleString(), icon: 'people', color: 'text-blue-500' },
                { label: 'Active Users', value: activeUsers.size.toLocaleString(), icon: 'person_check', color: 'text-green-500' },
                { label: 'New Users', value: newUsers.length.toLocaleString(), icon: 'person_add', color: 'text-purple-500' },
                { label: 'Inactive Users', value: (users.length - activeUsers.size).toLocaleString(), icon: 'person_off', color: 'text-gray-500' }
              ].map((metric, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-black text-gray-900">{metric.value}</p>
                    <span className={`material-symbols-outlined ${metric.color} text-2xl`}>{metric.icon}</span>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* User Growth Chart */}
          <div>
            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-4">User Growth</h4>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl">
              <p className="text-sm text-gray-500">Chart visualization coming soon...</p>
            </div>
          </div>
        </div>
      )}

      {/* Venue Report */}
      {selectedReport === 'venue' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Venue Performance Report</h3>
          
          {/* Venue Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Venues', value: venues.length.toLocaleString(), icon: 'location_city', color: 'text-blue-500' },
              { label: 'Active Venues', value: venues.filter(v => v.status === 'Active').length.toLocaleString(), icon: 'check_circle', color: 'text-green-500' },
              { label: 'Pending Venues', value: venues.filter(v => v.status === 'Pending').length.toLocaleString(), icon: 'pending', color: 'text-orange-500' },
              { label: 'Inactive Venues', value: venues.filter(v => v.status === 'Inactive').length.toLocaleString(), icon: 'cancel', color: 'text-red-500' }
            ].map((metric, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-black text-gray-900">{metric.value}</p>
                  <span className={`material-symbols-outlined ${metric.color} text-2xl`}>{metric.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Top Performing Venues */}
          <div>
            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-4">Top Performing Venues</h4>
            <div className="space-y-3">
              {(() => {
                const venueMap = new Map<string, { venue: any; bookings: number; revenue: number }>();
                bookings
                  .filter(b => {
                    const bookingDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.date);
                    return bookingDate >= dateRange.start && bookingDate <= dateRange.end && 
                           (b.status === 'Confirmed' || b.status === 'Completed');
                  })
                  .forEach(booking => {
                    const venue = venues.find(v => v.id === booking.venueId);
                    if (!venue) return;
                    const existing = venueMap.get(booking.venueId) || { venue, bookings: 0, revenue: 0 };
                    existing.bookings += 1;
                    existing.revenue += booking.amount || 0;
                    venueMap.set(booking.venueId, existing);
                  });
                
                return Array.from(venueMap.values())
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 10)
                  .map((data, index) => (
                    <div key={data.venue.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-black text-primary">{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{data.venue.name}</p>
                          <p className="text-xs text-gray-500">{data.bookings} bookings</p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-gray-900">{formatCurrency(data.revenue)}</p>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Support Section Component
const SupportSection: React.FC<{
  tickets: any[];
  bookings: any[];
  users: any[];
}> = ({ tickets, bookings, users }) => {
  const supportStats = useMemo(() => {
    const open = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
    const resolved = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
    const critical = tickets.filter(t => t.priority === 'Critical').length;
    const avgResolutionTime = 0; // Calculate from resolved tickets
    
    return { open, resolved, critical, total: tickets.length, avgResolutionTime };
  }, [tickets]);

  return (
    <div className="space-y-8">
      {/* Support Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Tickets', value: supportStats.total.toLocaleString(), icon: 'support_agent', color: 'text-blue-500' },
          { label: 'Open Tickets', value: supportStats.open.toLocaleString(), icon: 'pending', color: 'text-orange-500' },
          { label: 'Resolved', value: supportStats.resolved.toLocaleString(), icon: 'check_circle', color: 'text-green-500' },
          { label: 'Critical', value: supportStats.critical.toLocaleString(), icon: 'warning', color: 'text-red-500' }
        ].map((metric, i) => (
          <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900">{metric.value}</h3>
              <span className={`material-symbols-outlined ${metric.color} text-3xl`}>{metric.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Recent Support Tickets</h3>
        <div className="space-y-4">
          {tickets.slice(0, 10).map(ticket => {
            const user = users.find(u => u.id === ticket.userId);
            return (
              <div key={ticket.id} className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      ticket.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                      ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                      ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ticket.priority}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{ticket.subject}</p>
                      <p className="text-xs text-gray-500">{user?.name || 'Unknown User'} • {ticket.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      ticket.status === 'Open' ? 'bg-blue-100 text-blue-700' :
                      ticket.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {ticket.status}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CRM;
