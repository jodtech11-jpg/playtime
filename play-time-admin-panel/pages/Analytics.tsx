import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatUtils';
import { formatDate, getToday, getWeekStart, getWeekEnd, getMonthStart, getMonthEnd } from '../utils/dateUtils';
import DateRangePicker from '../components/DateRangePicker';

const COLORS = ['#11d473', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

const Analytics: React.FC = () => {
  const [dateRangeType, setDateRangeType] = useState<'week' | 'month' | 'custom'>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const today = getToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (dateRangeType) {
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

  // Fetch analytics data
  const {
    revenueTrends,
    userGrowth,
    venuePerformance,
    bookingPatternsByHour,
    bookingPatternsByDay,
    bookingPatternsBySport,
    periodComparison,
    loading
  } = useAnalytics({
    dateRange,
    includePreviousPeriod: true,
    realtime: false
  });

  // Top performing venues (top 5)
  const topVenues = useMemo(() => {
    return venuePerformance.slice(0, 5);
  }, [venuePerformance]);

  // Sport distribution for pie chart
  const sportDistribution = useMemo(() => {
    return bookingPatternsBySport.map((sport, index) => ({
      name: sport.sport,
      value: sport.percentage,
      revenue: sport.revenue,
      color: COLORS[index % COLORS.length]
    }));
  }, [bookingPatternsBySport]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Advanced Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Intelligence and optimization for your facility operations
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
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
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
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

      {/* Period Comparison Cards */}
      {periodComparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="ui-card p-6 flex flex-col justify-between group hover:border-emerald-400/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revenue Growth</span>
              <div className={`size-8 rounded-lg flex items-center justify-center ${periodComparison.revenueGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                <span className="material-symbols-outlined text-lg font-bold">
                  {periodComparison.revenueGrowth >= 0 ? 'trending_up' : 'trending_down'}
                </span>
              </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white my-2">
              {formatPercentage(periodComparison.revenueGrowth)}
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              ₹{periodComparison.currentRevenue.toLocaleString()} <span className="mx-1 opacity-40">vs</span> ₹{periodComparison.previousRevenue.toLocaleString()}
            </div>
          </div>

          <div className="ui-card p-6 flex flex-col justify-between group hover:border-blue-400/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bookings Growth</span>
              <div className={`size-8 rounded-lg flex items-center justify-center ${periodComparison.bookingsGrowth >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                }`}>
                <span className="material-symbols-outlined text-lg font-bold">
                  {periodComparison.bookingsGrowth >= 0 ? 'analytics' : 'trending_down'}
                </span>
              </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white my-2">
              {formatPercentage(periodComparison.bookingsGrowth)}
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              {periodComparison.currentBookings} <span className="mx-1 opacity-40">vs</span> {periodComparison.previousBookings} Bookings
            </div>
          </div>

          <div className="ui-card p-6 flex flex-col justify-between group hover:border-purple-400/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Value Variance</span>
              <div className={`size-8 rounded-lg flex items-center justify-center ${periodComparison.averageValueGrowth >= 0 ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'
                }`}>
                <span className="material-symbols-outlined text-lg font-bold">
                  {periodComparison.averageValueGrowth >= 0 ? 'payments' : 'money_off'}
                </span>
              </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white my-2">
              {formatPercentage(periodComparison.averageValueGrowth)}
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Average booking value change
            </div>
          </div>
        </div>
      )}

      {/* Revenue Trends Chart */}
      <div className="ui-card p-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">
          Financial Trajectory
        </h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrends}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#11d473" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#11d473" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dx={-10} tickFormatter={(val) => `₹${val / 1000}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#11d473" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User Growth Chart */}
      {/* User Growth Chart */}
      <div className="ui-card p-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">
          Audience Retention & Growth
        </h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dx={-10} />
              <Tooltip
                formatter={(value: number) => formatNumber(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }} />
              <Line type="monotone" dataKey="newUsers" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} name="New Entry" />
              <Line type="monotone" dataKey="totalUsers" stroke="#11d473" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} name="Total Base" />
              <Line type="monotone" dataKey="activeUsers" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} name="Retention" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Booking Patterns - Hour and Day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ui-card p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">
            Hourly Heatmap
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingPatternsByHour.filter(h => h.bookings > 0)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="hourLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dx={-10} />
                <Tooltip
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                />
                <Bar dataKey="bookings" fill="#11d473" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">
            Engagement by Day
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingPatternsByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dx={-10} />
                <Tooltip
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                />
                <Bar dataKey="bookings" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sport Distribution and Venue Performance */}
      {/* Sport Distribution and Venue Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ui-card p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">
            Sports Distribution
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sportDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sportDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                  formatter={(value: number, name: string, props: any) => [
                    `${formatPercentage(value)} (${formatCurrency(props.payload.revenue)})`,
                    name
                  ]}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-8">
            Elite Performers
          </h3>
          <div className="space-y-4">
            {topVenues.length === 0 ? (
              <p className="text-slate-400 text-center py-12 font-bold uppercase text-[10px] tracking-widest">No matching venue profiles found</p>
            ) : (
              topVenues.map((venue, index) => (
                <div key={venue.venueId} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 group hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className={`size-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${index === 0 ? 'bg-amber-400 shadow-amber-400/20' :
                        index === 1 ? 'bg-slate-300 shadow-slate-300/20' :
                          index === 2 ? 'bg-orange-400 shadow-orange-400/20' :
                            'bg-slate-200 dark:bg-slate-700 shadow-slate-700/10'
                      }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-black text-slate-900 dark:text-white leading-none">{venue.venueName}</div>
                      <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2">
                        <span>{formatNumber(venue.bookings)} Bookings</span>
                        <span className="size-1 rounded-full bg-slate-300"></span>
                        <span className="text-primary">{formatPercentage(venue.occupancyRate)} Occupancy</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 dark:text-white">{formatCurrency(venue.revenue)}</div>
                    {venue.growth !== undefined && (
                      <div className={`text-[10px] font-black mt-1 ${venue.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {venue.growth >= 0 ? '↑' : '↓'} {formatPercentage(Math.abs(venue.growth))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Date Range Picker Modal */}
      {showDatePicker && (
        <DateRangePicker
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelect={(range) => {
            setCustomDateRange(range);
            setDateRangeType('custom');
            setShowDatePicker(false);
          }}
          initialRange={dateRange}
        />
      )}
    </div>
  );
};

export default Analytics;

