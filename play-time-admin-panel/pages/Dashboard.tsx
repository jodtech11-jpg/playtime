import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useBookings, usePendingBookings } from '../hooks/useBookings';
import { useActiveMemberships } from '../hooks/useMemberships';
import { useVenues } from '../hooks/useVenues';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatCurrency, formatNumber, getStatusColor, formatPercentage } from '../utils/formatUtils';
import { getRelativeTime, isToday, formatDate, formatTime, getToday, getWeekStart, getWeekEnd, getMonthStart, getMonthEnd } from '../utils/dateUtils';
import { Booking, User } from '../types';
import { usersCollection } from '../services/firebase';
import DateRangePicker from '../components/shared/DateRangePicker';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dateRangeType, setDateRangeType] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recentSignups, setRecentSignups] = useState<User[]>([]);

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
        return { start: today, end: tomorrow };
      default:
        return { start: today, end: tomorrow };
    }
  }, [dateRangeType, customDateRange]);

  // Fetch data with date range
  const { bookings, loading: bookingsLoading } = useBookings({
    dateRange,
    realtime: true
  });
  const { bookings: pendingBookings } = usePendingBookings();
  const { memberships: activeMemberships, loading: membershipsLoading } = useActiveMemberships();
  const { venues, loading: venuesLoading } = useVenues({ realtime: true });

  useEffect(() => {
    let mounted = true;
    usersCollection.getRecent(8).then((users) => {
      if (mounted) setRecentSignups(users as User[]);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Fetch analytics data with period comparison
  const { periodComparison, loading: analyticsLoading } = useAnalytics({
    dateRange,
    includePreviousPeriod: true,
    realtime: false
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const bookingsCount = bookings.length;
    const pendingCount = pendingBookings.length;

    // Calculate total revenue from confirmed bookings in date range
    const totalRevenue = bookings
      .filter(b => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    // Calculate pending payments in date range
    const pendingPayments = bookings
      .filter(b => b.paymentStatus === 'Pending')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    // Calculate active memberships count
    const activeMembersCount = activeMemberships.length;

    return {
      bookings: bookingsCount,
      totalRevenue: totalRevenue,
      activeMembers: activeMembersCount,
      pendingPayments: pendingPayments,
      pendingCount: pendingCount
    };
  }, [bookings, pendingBookings, activeMemberships]);

  // Generate revenue trend data based on selected date range
  const revenueTrendData = useMemo(() => {
    const days = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Determine interval based on date range length
    let interval = 1; // Daily
    if (diffDays > 90) {
      interval = 7; // Weekly
    } else if (diffDays > 30) {
      interval = 2; // Every 2 days
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + interval)) {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);

      const dayBookings = bookings.filter((b: Booking) => {
        if (!b.startTime) return false;
        const bookingDate = b.startTime.toDate ? b.startTime.toDate() : new Date(b.startTime);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() >= date.getTime() &&
          bookingDate.getTime() < date.getTime() + (interval * 24 * 60 * 60 * 1000) &&
          b.status === 'Confirmed' &&
          b.paymentStatus === 'Paid';
      });

      const revenue = dayBookings.reduce((sum: number, b: Booking) => sum + (b.amount || 0), 0);

      days.push({
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenue,
        bookings: dayBookings.length
      });
    }

    return days;
  }, [bookings, dateRange]);

  // Calculate peak hours
  const peakHoursData = useMemo(() => {
    const hours: Record<number, number> = {};

    bookings.forEach((booking: Booking) => {
      if (!booking.startTime) return;
      const date = booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
      const hour = date.getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });

    return [
      { hour: '12PM', value: hours[12] || 0 },
      { hour: '2PM', value: hours[14] || 0 },
      { hour: '4PM', value: hours[16] || 0 },
      { hour: '6PM', value: hours[18] || 0 },
      { hour: '8PM', value: hours[20] || 0 },
      { hour: '10PM', value: hours[22] || 0 },
    ];
  }, [bookings]);

  // Get recent activity (last 10 bookings)
  const recentActivity = useMemo(() => {
    return bookings
      .slice(0, 10)
      .map((booking: Booking) => {
        let icon = 'calendar_add_on';
        let color = 'text-blue-600';
        let bg = 'bg-blue-100';
        let title = '';
        let sub = '';

        if (booking.status === 'Pending') {
          icon = 'schedule';
          color = 'text-amber-600';
          bg = 'bg-amber-100';
          title = `New booking for ${booking.court} (${booking.sport})`;
          sub = `${booking.user} • ${booking.duration} hour${booking.duration > 1 ? 's' : ''} slot`;
        } else if (booking.paymentStatus === 'Paid') {
          icon = 'payments';
          color = 'text-green-600';
          bg = 'bg-green-100';
          title = `Payment received: ${formatCurrency(booking.amount)}`;
          sub = `Booking #${booking.id.substring(0, 8)}`;
        } else {
          title = `Booking for ${booking.court}`;
          sub = `${booking.user} • ${formatTime(booking.startTime)}`;
        }

        return {
          title,
          sub,
          time: getRelativeTime(booking.createdAt),
          icon,
          color,
          bg
        };
      });
  }, [bookings]);

  // Get live court status
  const liveCourtStatus = useMemo(() => {
    const now = new Date();
    const activeBookings = bookings.filter((booking: Booking) => {
      if (!booking.startTime || !booking.endTime) return false;
      const start = booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
      const end = booking.endTime.toDate ? booking.endTime.toDate() : new Date(booking.endTime);
      return booking.status === 'Confirmed' && now >= start && now <= end;
    });

    // Group by court
    const courtMap = new Map<string, { name: string; type: string; status: string; color: string }>();

    activeBookings.forEach((booking: Booking) => {
      courtMap.set(booking.courtId, {
        name: booking.court,
        type: booking.sport,
        status: 'In Use',
        color: 'red'
      });
    });

    // Add courts from venues that aren't booked
    venues.forEach(venue => {
      venue.courts?.forEach(court => {
        if (!courtMap.has(court.id)) {
          courtMap.set(court.id, {
            name: court.name,
            type: court.sport,
            status: court.status === 'Maintenance' ? 'Maint.' : 'Free',
            color: court.status === 'Maintenance' ? 'yellow' : 'green'
          });
        }
      });
    });

    return Array.from(courtMap.values()).slice(0, 10);
  }, [bookings, venues]);

  // Top venues by booking count in date range
  const topVenuesByBookings = useMemo(() => {
    const byVenue: Record<string, number> = {};
    bookings.forEach((b: Booking) => {
      const vid = b.venueId || '';
      if (vid) byVenue[vid] = (byVenue[vid] || 0) + 1;
    });
    return Object.entries(byVenue)
      .map(([venueId, count]) => ({
        venueId,
        name: venues.find((v) => v.id === venueId)?.name || 'Unknown',
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [bookings, venues]);

  const loading = bookingsLoading || membershipsLoading || venuesLoading || analyticsLoading;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome back, {user?.name || 'User'} 👋
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {dateRangeType === 'today' && "Real-time overview of your facilities today."}
            {dateRangeType === 'week' && "Weekly performance metrics and schedule."}
            {dateRangeType === 'month' && "Monthly facility analytics and growth."}
            {dateRangeType === 'custom' && `Performance data from ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}.`}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            onClick={() => {
              setDateRangeType('today');
              setCustomDateRange(null);
            }}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${dateRangeType === 'today'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            Today
          </button>
          <button
            onClick={() => {
              setDateRangeType('week');
              setCustomDateRange(null);
            }}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${dateRangeType === 'week'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            Week
          </button>
          <button
            onClick={() => {
              setDateRangeType('month');
              setCustomDateRange(null);
            }}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 ${dateRangeType === 'month'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            Month
          </button>
          <button
            onClick={() => setShowDatePicker(true)}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all duration-200 flex items-center gap-1.5 ${dateRangeType === 'custom'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Custom
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: dateRangeType === 'today' ? "Today's Bookings" : "Bookings",
            val: formatNumber(stats.bookings),
            change: stats.bookings > 0 ? `+${stats.bookings}` : '0',
            trend: stats.bookings > 0 ? 'up' : 'neutral',
            icon: 'sports_soccer',
            color: 'text-primary',
            bg: 'bg-primary/10'
          },
          {
            label: "Total Revenue",
            val: formatCurrency(stats.totalRevenue),
            change: periodComparison
              ? `${periodComparison.revenueGrowth >= 0 ? '+' : ''}${formatPercentage(periodComparison.revenueGrowth)}`
              : 'N/A',
            trend: periodComparison
              ? (periodComparison.revenueGrowth > 0 ? 'up' : periodComparison.revenueGrowth < 0 ? 'down' : 'neutral')
              : (stats.totalRevenue > 0 ? 'up' : 'neutral'),
            icon: 'attach_money',
            color: 'text-blue-600',
            bg: 'bg-blue-50'
          },
          {
            label: "Active Members",
            val: formatNumber(stats.activeMembers),
            change: stats.activeMembers > 0 ? '+2%' : '0%',
            trend: stats.activeMembers > 0 ? 'up' : 'neutral',
            icon: 'diversity_3',
            color: 'text-purple-600',
            bg: 'bg-purple-50'
          },
          {
            label: "Pending Payments",
            val: formatCurrency(stats.pendingPayments),
            change: `${stats.pendingCount} action${stats.pendingCount !== 1 ? 's' : ''}`,
            trend: stats.pendingCount > 0 ? 'down' : 'neutral',
            icon: 'pending_actions',
            color: 'text-orange-600',
            bg: 'bg-orange-50'
          },
        ].map((stat, i) => (
          <div key={i} className="ui-card p-6 flex flex-col justify-between group hover:border-primary/40 transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-bold tracking-wide uppercase">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stat.val}</h3>
              </div>
              <div className={`${stat.bg} p-3 rounded-xl ${stat.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              {stat.trend !== 'neutral' && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black ${stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'
                  }`}>
                  <span className="material-symbols-outlined text-sm font-bold">
                    {stat.trend === 'up' ? 'trending_up' : 'trending_down'}
                  </span>
                  {stat.change}
                </div>
              )}
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">vs previous period</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ui-card p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Revenue Trend</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-black uppercase text-slate-500">Current</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] min-h-[280px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#11d473" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#11d473" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dx={-10} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                  itemStyle={{ color: '#11d473' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#11d473" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">Busy Hours</h3>
          <div className="flex-1 min-h-[300px] min-w-0 w-full" style={{ minHeight: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }} />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ui-card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Recent Activity</h3>
            <button className="text-xs font-black text-primary hover:underline uppercase tracking-widest">
              Review All
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentActivity.length > 0 ? (
              recentActivity.map((act, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className={`size-10 rounded-xl ${act.bg} flex items-center justify-center ${act.color} shrink-0 shadow-sm`}>
                    <span className="material-symbols-outlined text-[20px] font-bold">{act.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{act.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{act.sub}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">{act.time}</span>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400">
                <p className="font-bold">No activity recorded</p>
              </div>
            )}
          </div>
        </div>

        <div className="ui-card flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Court Status</h3>
          </div>
          <div className="p-2 overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase px-4 py-3 tracking-widest">Court</th>
                  <th className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase px-4 py-3 text-right tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {liveCourtStatus.length > 0 ? (
                  liveCourtStatus.map((court, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700 last:border-0 group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-900 dark:text-white leading-none">{court.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase mt-1.5">{court.type}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase ${court.status === 'In Use' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                          court.status === 'Maint.' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                            'bg-slate-100 text-slate-500 dark:bg-slate-700'
                          }`}>
                          <span className={`size-1.5 rounded-full ${court.status === 'In Use' ? 'bg-emerald-600 animate-pulse' :
                            court.status === 'Maint.' ? 'bg-amber-600' : 'bg-slate-400'
                            }`}></span>
                          {court.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-slate-400 text-xs font-bold">
                      No live data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ui-card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Top Venues by Bookings</h3>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">In selected period</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {topVenuesByBookings.length > 0 ? (
              topVenuesByBookings.map((row, i) => (
                <div key={row.venueId} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 w-6">{i + 1}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{row.name}</span>
                  </div>
                  <span className="text-sm font-black text-primary">{row.count} booking{row.count !== 1 ? 's' : ''}</span>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">No bookings in period</div>
            )}
          </div>
        </div>
        <div className="ui-card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Recent Signups</h3>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">New users</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentSignups.length > 0 ? (
              recentSignups.map((u) => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.name || '—'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email || ''}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap ml-2">
                    {u.createdAt ? getRelativeTime(u.createdAt) : '—'}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">No recent signups</div>
            )}
          </div>
        </div>
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

export default Dashboard;
