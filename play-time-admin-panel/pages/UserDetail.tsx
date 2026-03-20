import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { useBookings } from '../hooks/useBookings';
import { useMemberships } from '../hooks/useMemberships';
import { useOrders } from '../hooks/useOrders';
import { useTeams } from '../hooks/useTeams';
import { useWalletTransactions } from '../hooks/useWalletTransactions';
import { useVenues } from '../hooks/useVenues';
import { usersCollection } from '../services/firebase';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getStatusColor, formatCurrency } from '../utils/formatUtils';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import UserFormModal from '../components/modals/UserFormModal';

const UserDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { users } = useUsers();
  const { venues } = useVenues({ realtime: true });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Get user bookings
  const { bookings: userBookings, loading: bookingsLoading } = useBookings({
    realtime: true
  });

  // Get user memberships
  const { memberships: userMemberships, loading: membershipsLoading } = useMemberships({
    realtime: true
  });

  // Get user orders
  const { orders: userOrders, loading: ordersLoading } = useOrders({
    userId: userId,
    realtime: true
  });

  // Get user teams
  const { teams: userTeams, loading: teamsLoading } = useTeams({
    userId: userId,
    realtime: true
  });

  // Get wallet transactions
  const { transactions: walletTransactions, loading: transactionsLoading } = useWalletTransactions({
    userId: userId,
    realtime: true,
    limit: 20
  });

  // Filter bookings and memberships for this user
  const filteredBookings = useMemo(() => {
    if (!userId) return [];
    return userBookings.filter(b => b.userId === userId);
  }, [userBookings, userId]);

  const filteredMemberships = useMemo(() => {
    if (!userId) return [];
    return userMemberships.filter(m => m.userId === userId);
  }, [userMemberships, userId]);

  // Calculate statistics
  const stats = useMemo(() => {
    const completedBookings = filteredBookings.filter(b => b.status === 'Completed').length;
    const totalBookings = filteredBookings.length;
    const winRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;
    const walletBalance = user?.walletBalance || 0;
    const userLevel = user?.level || 1;
    const totalOrders = userOrders.length;
    const totalTeams = userTeams.length;

    return {
      totalBookings,
      completedBookings,
      winRate,
      walletBalance,
      userLevel,
      totalOrders,
      totalTeams
    };
  }, [filteredBookings, userOrders, userTeams, user]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Try to get from users list first
        const foundUser = users.find(u => u.id === userId);
        if (foundUser) {
          setUser(foundUser);
        } else {
          // Fetch directly
          const userData = await usersCollection.get(userId);
          setUser(userData as User);
        }
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching user:', err);
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, users]);

  const handleSaveUser = async (userData: Partial<User>) => {
    if (!user) return;

    try {
      setProcessing('saving');

      // Prepare update data
      const updateData: any = {
        ...userData,
        updatedAt: serverTimestamp()
      };

      // If role is being changed to 'player' or 'super_admin', clear managedVenues
      if (userData.role && (userData.role === 'player' || userData.role === 'super_admin')) {
        updateData.managedVenues = [];
      }

      // If role is being changed from 'venue_manager' to something else, ensure managedVenues is cleared
      if (user.role === 'venue_manager' && userData.role && userData.role !== 'venue_manager') {
        updateData.managedVenues = [];
      }

      await usersCollection.update(user.id, updateData);

      // Update local state with the new data
      const updatedUser = { ...user, ...updateData } as User;
      setUser(updatedUser);
      setIsModalOpen(false);
      setProcessing(null);
      showSuccess('User updated successfully.');
    } catch (err: any) {
      console.error('Error saving user:', err);
      setProcessing(null);
      showError(`Failed to save user: ${err.message}`);
    }
  };

  const handleStatusChange = async (newStatus: 'Active' | 'Pending' | 'Inactive') => {
    if (!user) return;

    try {
      setProcessing('status');
      await usersCollection.update(user.id, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setUser({ ...user, status: newStatus });
      setProcessing(null);
      showSuccess(`User status updated to ${newStatus}.`);
    } catch (err: any) {
      console.error('Error updating user status:', err);
      setProcessing(null);
      showError(`Failed to update user status: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading user...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">User not found</p>
          <button
            onClick={() => navigate('/users')}
            className="text-primary hover:text-primary-hover"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(user.status);
  const managedVenueNames = user.managedVenues
    ?.map(venueId => venues.find(v => v.id === venueId)?.name)
    .filter(Boolean) || [];

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-10 bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
        <button onClick={() => navigate('/users')} className="hover:text-primary transition-colors">
          Users
        </button>
        <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
        <span className="text-slate-700 dark:text-slate-200 truncate max-w-xs">{user.name || user.email}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/users')}
            aria-label="Back to users"
            className="size-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">User Profile</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">Manage user account and view activity history.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">edit_note</span>
            Edit Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Information Card */}
        <div className="lg:col-span-1 space-y-6 sm:space-y-8">
          {/* Profile Card */}
          <div className="ui-card p-4 sm:p-8 group">
            <div className="text-center">
              <div className="size-28 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6 border border-slate-200 dark:border-slate-700 overflow-hidden group-hover:scale-105 transition-transform duration-500">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-black text-5xl">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2 leading-none">{user.name}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">{user.email}</p>

              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                  user.role === 'venue_manager' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                  {user.role === 'super_admin' ? 'Admin' : user.role === 'venue_manager' ? 'Vendor' : 'Player'}
                </span>

                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  user.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                  <span className={`size-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' :
                    user.status === 'Pending' ? 'bg-amber-500' : 'bg-slate-400'
                    }`}></span>
                  {user.status}
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-xl">fingerprint</span>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">User ID</p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate max-w-[180px]">{user.id}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">phone_iphone</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{user.phone}</p>
                  </div>
                </div>
              )}

              {user.createdAt && (
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">history</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Joined</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{formatDate(user.createdAt.toDate())}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">{getRelativeTime(user.createdAt.toDate())}</p>
                  </div>
                </div>
              )}

              {user.level && (
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">military_tech</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-end justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Level</p>
                      <span className="text-xs font-black text-primary">LVL {user.level}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${user.progress || 0}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Managed Venues Card */}
          {user.role === 'venue_manager' && managedVenueNames.length > 0 && (
            <div className="ui-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-5 w-1 rounded-full bg-amber-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Managed Venues</h3>
              </div>
              <div className="space-y-3">
                {managedVenueNames.map((name, idx) => {
                  const venue = venues.find(v => v.name === name);
                  return (
                    <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 group cursor-pointer hover:border-amber-400/30 hover:bg-white transition-all">
                      <div className="size-10 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-amber-600 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined">hub</span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{name}</p>
                        {venue && (
                          <p className="text-[10px] font-bold text-slate-500 truncate mt-1">{venue.address}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          {/* Enhanced Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="ui-card p-6 flex flex-col justify-between group hover:border-blue-400/40 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">event_available</span>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">ACTIVITY</span>
              </div>
              <div className="mt-8">
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.totalBookings}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Bookings</p>
              </div>
            </div>

            <div className="ui-card p-6 flex flex-col justify-between group hover:border-emerald-400/40 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                </div>
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">BALANCE</span>
              </div>
              <div className="mt-8">
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{formatCurrency(stats.walletBalance)}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Wallet</p>
              </div>
            </div>

            <div className="ui-card p-6 flex flex-col justify-between group hover:border-amber-400/40 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">groups</span>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">SOCIAL</span>
              </div>
              <div className="mt-8">
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.totalTeams}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Teams</p>
              </div>
            </div>

            <div className="ui-card p-6 flex flex-col justify-between group hover:border-rose-400/40 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 group-hover:bg-rose-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-xl">shield</span>
                </div>
                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none">STANDING</span>
              </div>
              <div className="mt-8">
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{user.totalXP || 0}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Accumulated</p>
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="ui-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="h-5 w-1 rounded-full bg-blue-500"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Recent Bookings</h3>
            </div>
            <div className="overflow-x-auto">
              {bookingsLoading ? (
                <div className="p-20 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading bookings...</p>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <span className="material-symbols-outlined text-3xl">calendar_today</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No activity detected</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Venue</th>
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {filteredBookings.slice(0, 10).map((booking) => {
                      const venue = venues.find(v => v.id === booking.venueId);
                      return (
                        <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-black text-slate-900 dark:text-white block leading-none">{venue?.name || 'GENERIC VENUE'}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{booking.court}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{booking.startTime ? formatDate(booking.startTime.toDate()) : '—'}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">BOOKING TIME</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(booking.amount || 0)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${booking.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              booking.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                              }`}>
                              {booking.status}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Wallet Transactions */}
          <div className="ui-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="h-5 w-1 rounded-full bg-emerald-500"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Wallet Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              {transactionsLoading ? (
                <div className="p-20 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading transactions...</p>
                </div>
              ) : walletTransactions.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No financial data</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Balance After</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {walletTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${transaction.type === 'Credit' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                            }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-xs font-black ${transaction.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {transaction.type === 'Credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                          {transaction.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-slate-900 dark:text-white">
                          {formatCurrency(transaction.balanceAfter)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-bold">
                          {transaction.createdAt ? formatDate(transaction.createdAt.toDate()) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Player Statistics Section - Only for Player Role */}
          {user.role === 'player' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-base font-black text-gray-900">Player Statistics</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Matches Played</p>
                    <p className="text-xl font-black text-gray-900">{user.totalMatches || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Matches Won</p>
                    <p className="text-xl font-black text-gray-900">{user.matchesWon || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Streak</p>
                    <p className="text-xl font-black text-gray-900">{user.streak || 0} days</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Longest Streak</p>
                    <p className="text-xl font-black text-gray-900">{user.longestStreak || 0} days</p>
                  </div>
                  {user.totalXP !== undefined && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total XP</p>
                      <p className="text-xl font-black text-gray-900">{user.totalXP}</p>
                    </div>
                  )}
                  {user.totalSpent !== undefined && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Spent</p>
                      <p className="text-xl font-black text-gray-900">{formatCurrency(user.totalSpent)}</p>
                    </div>
                  )}
                </div>

                {/* Sport Breakdown */}
                {user.sportStats && Object.keys(user.sportStats).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-black text-gray-900 mb-4">Sport Breakdown</h4>
                    <div className="space-y-2">
                      {Object.entries(user.sportStats).map(([sport, count]) => (
                        <div key={sport} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-900">{sport}</span>
                          <span className="text-sm font-bold text-primary">{count} games</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Achievements */}
                {user.achievements && user.achievements.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-black text-gray-900 mb-4">Achievements</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {user.achievements.map((achievement: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <span className="material-symbols-outlined text-yellow-600">emoji_events</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{achievement.name || 'Achievement'}</p>
                            {achievement.description && (
                              <p className="text-xs text-gray-500">{achievement.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {user.notificationSettings && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-base font-black text-gray-900">Notification Settings</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Booking Notifications</p>
                      <p className="text-xs text-gray-500">Get notified about booking confirmations</p>
                    </div>
                    <span className={`material-symbols-outlined ${user.notificationSettings.booking ? 'text-green-600' : 'text-gray-400'
                      }`}>
                      {user.notificationSettings.booking ? 'toggle_on' : 'toggle_off'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Match Notifications</p>
                      <p className="text-xs text-gray-500">Updates about matches and tournaments</p>
                    </div>
                    <span className={`material-symbols-outlined ${user.notificationSettings.match ? 'text-green-600' : 'text-gray-400'
                      }`}>
                      {user.notificationSettings.match ? 'toggle_on' : 'toggle_off'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Social Notifications</p>
                      <p className="text-xs text-gray-500">Likes, comments, and social feed updates</p>
                    </div>
                    <span className={`material-symbols-outlined ${user.notificationSettings.social ? 'text-green-600' : 'text-gray-400'
                      }`}>
                      {user.notificationSettings.social ? 'toggle_on' : 'toggle_off'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Promotional Notifications</p>
                      <p className="text-xs text-gray-500">Deals, offers, and promotional content</p>
                    </div>
                    <span className={`material-symbols-outlined ${user.notificationSettings.promotional ? 'text-green-600' : 'text-gray-400'
                      }`}>
                      {user.notificationSettings.promotional ? 'toggle_on' : 'toggle_off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Memberships */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-base font-black text-gray-900">Memberships</h3>
            </div>
            <div className="overflow-x-auto">
              {membershipsLoading ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm text-gray-500">Loading memberships...</p>
                </div>
              ) : filteredMemberships.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">card_membership</span>
                  <p className="font-medium">No memberships found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Venue</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Start Date</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">End Date</th>
                      <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMemberships.map((membership) => {
                      const venue = venues.find(v => v.id === membership.venueId);
                      const membershipStatusColors = getStatusColor(membership.status);
                      return (
                        <tr key={membership.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {membership.planName} ({membership.planType})
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {venue?.name || 'Unknown Venue'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {membership.startDate ? formatDate(membership.startDate.toDate()) : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {membership.endDate ? formatDate(membership.endDate.toDate()) : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${membershipStatusColors.bg} ${membershipStatusColors.text}`}>
                              {membership.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {isModalOpen && (
        <UserFormModal
          user={user}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default UserDetail;

