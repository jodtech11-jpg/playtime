import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { useVenues } from '../hooks/useVenues';
import { usersCollection } from '../services/firebase';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { getStatusColor } from '../utils/formatUtils';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import UserFormModal from '../components/UserFormModal';
import { serverTimestamp } from 'firebase/firestore';

const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Inactive'>('All');
  const [roleFilter, setRoleFilter] = useState<'All' | 'super_admin' | 'venue_manager' | 'player'>('All');

  const { users, loading, error } = useUsers({ searchTerm: searchQuery });
  const { venues } = useVenues({ realtime: true });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Filter users based on status and role filters (venue filtering is done in useUsers hook)
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(u => u.status === statusFilter);
    }

    // Apply role filter
    if (roleFilter !== 'All') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    return filtered;
  }, [users, statusFilter, roleFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalUsers = filteredUsers.length;
    const activeUsers = filteredUsers.filter(u => u.status === 'Active').length;
    const pendingUsers = filteredUsers.filter(u => u.status === 'Pending').length;
    const players = filteredUsers.filter(u => u.role === 'player').length;
    const superAdmins = filteredUsers.filter(u => u.role === 'super_admin').length;
    const venueManagers = filteredUsers.filter(u => u.role === 'venue_manager').length;

    return {
      totalUsers,
      activeUsers,
      players,
      superAdmins,
      venueManagers
    };
  }, [filteredUsers]);

  const handleCreateUser = () => {
    // Venue managers can only create venue managers
    if (currentUser?.role === 'venue_manager') {
      // This is handled in the modal, but we can add a note here if needed
    }
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(handleCreateUser);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (userData: Partial<User>) => {
    try {
      setProcessing('saving');

      // Permission checks
      if (currentUser?.role === 'venue_manager') {
        // Venue managers cannot create/assign super admins
        if (userData.role === 'super_admin') {
          throw new Error('Venue managers cannot create or assign super admin role');
        }

        // Venue managers can only assign venues they manage
        if (userData.managedVenues && userData.managedVenues.length > 0) {
          const invalidVenues = userData.managedVenues.filter(
            venueId => !currentUser.managedVenues?.includes(venueId)
          );
          if (invalidVenues.length > 0) {
            throw new Error('You can only assign venues that you manage');
          }
        }
      }

      if (selectedUser) {
        // Update existing user
        // Prevent venue managers from changing roles of other users
        if (currentUser?.role === 'venue_manager' && selectedUser.id !== currentUser.id) {
          if (userData.role && userData.role !== selectedUser.role) {
            throw new Error('You cannot change user roles');
          }
        }

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
        if (selectedUser.role === 'venue_manager' && userData.role && userData.role !== 'venue_manager') {
          updateData.managedVenues = [];
        }

        await usersCollection.update(selectedUser.id, updateData);
      } else {
        // Create new user - Note: This only creates Firestore document
        // Actual Firebase Auth user creation should be done via admin script or backend
        // Use email as base for ID, but sanitize it
        const emailBase = userData.email?.replace(/[^a-zA-Z0-9]/g, '_') || `user_${Date.now()}`;
        const newUserId = userData.id || emailBase;

        // Venue managers can only create venue managers (not players or super admins)
        if (currentUser?.role === 'venue_manager') {
          if (userData.role !== 'venue_manager') {
            userData.role = 'venue_manager';
          }
        }
        // Super admins can create any role, but default to 'player' if not specified
        else if (currentUser?.role === 'super_admin' && !userData.role) {
          userData.role = 'player';
        }

        await usersCollection.create(newUserId, {
          id: newUserId,
          ...userData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setSelectedUser(null);
      setProcessing(null);
    } catch (err: any) {
      console.error('Error saving user:', err);
      setProcessing(null);
      alert(`Failed to save user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setProcessing(userId);
      await usersCollection.delete(userId);
      setProcessing(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setProcessing(null);
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'Active' | 'Pending' | 'Inactive') => {
    try {
      setProcessing(userId);
      await usersCollection.update(userId, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setProcessing(null);
    } catch (err: any) {
      console.error('Error updating user status:', err);
      setProcessing(null);
      alert(`Failed to update user status: ${err.message}`);
    }
  };

  const handleApproveUser = async (userId: string) => {
    if (!confirm('Approve this vendor? They will be able to access the platform.')) {
      return;
    }
    await handleStatusChange(userId, 'Active');
  };

  const handleRejectUser = async (userId: string) => {
    if (!confirm('Reject this vendor? Their account will be deactivated.')) {
      return;
    }
    await handleStatusChange(userId, 'Inactive');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Error loading users</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Users</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">Manage user accounts, roles, and platform access.</p>
        </div>
        <button
          onClick={handleCreateUser}
          className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-6 py-3 text-white text-sm font-black shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Add User
        </button>
      </div>

      {/* Statistics Cards */}
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <div className="ui-card p-6 flex flex-col justify-between group hover:border-primary/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Global</span>
          </div>
          <div className="mt-6">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.totalUsers}</p>
            <p className="text-xs font-bold text-slate-500 mt-2">Total Registered</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-emerald-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Verified</span>
          </div>
          <div className="mt-6">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.activeUsers}</p>
            <p className="text-xs font-bold text-slate-500 mt-2">Active Users</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-blue-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-2xl">sports_soccer</span>
            </div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">Players</span>
          </div>
          <div className="mt-6">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.players}</p>
            <p className="text-xs font-bold text-slate-500 mt-2">Total Players</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-amber-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Vendors</span>
          </div>
          <div className="mt-6">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.venueManagers}</p>
            <p className="text-xs font-bold text-slate-500 mt-2">Total Vendors</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-purple-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-2xl">shield_person</span>
            </div>
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest leading-none">Authority</span>
          </div>
          <div className="mt-6">
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.superAdmins}</p>
            <p className="text-xs font-bold text-slate-500 mt-2">Total Admins</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 rounded-full bg-primary"></div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-none">User List</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              search
            </span>
            <input
              className="w-full sm:w-80 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-transparent text-slate-900 dark:text-white py-2 pl-10 text-xs font-bold focus:bg-white focus:border-primary transition-all outline-none"
              placeholder="Search users..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white transition-all shadow-sm"
          >
            <option value="All">Status: All</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="h-10 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white transition-all shadow-sm"
          >
            <option value="All">Role: All</option>
            <option value="player">Role: Player</option>
            <option value="venue_manager">Role: Vendor</option>
            <option value="super_admin">Role: Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-6 py-5">User</th>
                <th className="px-6 py-5">Role</th>
                <th className="px-6 py-5">Phone</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Venues</th>
                <th className="px-6 py-5">Joined</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="size-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <span className="material-symbols-outlined text-4xl">person_off</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const statusColors = getStatusColor(user.status);
                  const managedVenueNames = user.managedVenues
                    ?.map(venueId => venues.find(v => v.id === venueId)?.name)
                    .filter(Boolean) || [];

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer group" onClick={() => navigate(`/users/${user.id}`)}>
                      <td className="px-6 py-4 flex items-center gap-4">
                        <div className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform">
                          {user.avatar ? (
                            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-sm font-black text-primary">{user.name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <span className="font-black text-slate-900 dark:text-white block leading-none">{user.name}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' :
                          user.role === 'venue_manager' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                            'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                          }`}>
                          {user.role === 'super_admin' ? 'Executive' : user.role === 'venue_manager' ? 'Vendor' : 'Player'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{user.phone || '—'}</span>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          user.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}>
                          <span className={`size-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' :
                            user.status === 'Pending' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}></span>
                          {user.status === 'Active' ? 'Active' : user.status === 'Pending' ? 'Pending' : 'Inactive'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.role === 'venue_manager' && managedVenueNames.length > 0 ? (
                            managedVenueNames.slice(0, 2).map((name, idx) => (
                              <span key={idx} className="text-[10px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {name}{idx < Math.min(managedVenueNames.length, 2) - 1 ? ',' : ''}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-500">{user.createdAt ? formatDate(user.createdAt.toDate()) : 'ARCHIVE'}</span>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {user.status === 'Pending' && currentUser?.role === 'super_admin' && (
                            <>
                              <button
                                onClick={() => handleApproveUser(user.id)}
                                disabled={processing === user.id}
                                className="size-8 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:scale-110 transition-all shadow-lg shadow-emerald-500/20"
                              >
                                <span className="material-symbols-outlined text-base">check</span>
                              </button>
                              <button
                                onClick={() => handleRejectUser(user.id)}
                                disabled={processing === user.id}
                                className="size-8 flex items-center justify-center bg-rose-500 text-white rounded-lg hover:scale-110 transition-all shadow-lg shadow-rose-500/20"
                              >
                                <span className="material-symbols-outlined text-base">close</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/users/${user.id}`)}
                            className="size-8 flex items-center justify-center text-slate-400 hover:text-primary transition-all rounded-lg"
                          >
                            <span className="material-symbols-outlined text-xl">visibility</span>
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="size-8 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-lg transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">settings</span>
                          </button>
                          {currentUser?.role === 'super_admin' && currentUser?.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={processing === user.id}
                              className="size-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                            >
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form Modal */}
      {isModalOpen && (
        <UserFormModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default Users;

