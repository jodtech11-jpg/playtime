import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVenues } from '../hooks/useVenues';
import { useBookings } from '../hooks/useBookings';
import { useUsers } from '../hooks/useUsers';
import { venuesCollection } from '../services/firebase';
import { Venue } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import VenueFormModal from '../components/modals/VenueFormModal';
import CourtManagementModal from '../components/modals/CourtManagementModal';
import { serverTimestamp } from 'firebase/firestore';

const Venues: React.FC = () => {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { showSuccess, showError } = useToast();
  const { venues, loading: venuesLoading } = useVenues({ realtime: true });
  const { bookings } = useBookings({ realtime: true });
  const { users } = useUsers({ limit: 100 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [venueForCourts, setVenueForCourts] = useState<Venue | null>(null);

  // View and filter states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Venue['status']>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [managerFilter, setManagerFilter] = useState<string>('All');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Calculate occupancy for each venue
  const venueStats = useMemo(() => {
    const stats = new Map<string, { occupancy: number; revenue: number }>();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    venues.forEach(venue => {
      // Filter to today's confirmed bookings for occupancy (daily metric)
      const todayBookings = bookings.filter(b => {
        if (b.venueId !== venue.id || b.status !== 'Confirmed') return false;
        if (!b.startTime) return false;
        const startDate = b.startTime.toDate ? b.startTime.toDate() : new Date(b.startTime as any);
        return startDate >= today && startDate < tomorrow;
      });
      const totalSlots = venue.courts?.length || 1;
      // Total hours booked today across all courts
      const totalBookedHours = todayBookings.reduce((sum, b) => sum + (b.duration || 1), 0);
      // Available hours = courts × 14 operating hours (8am–10pm)
      const totalAvailableHours = totalSlots * 14;
      const occupancy = totalAvailableHours > 0 ? Math.min(100, Math.round((totalBookedHours / totalAvailableHours) * 100)) : 0;
      const venueBookings = bookings.filter(b => b.venueId === venue.id && b.status === 'Confirmed');
      const revenue = venueBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

      stats.set(venue.id, { occupancy, revenue });
    });

    return stats;
  }, [venues, bookings]);

  // Get all unique sports for filter
  const allSports = useMemo(() => {
    const sportsSet = new Set<string>();
    venues.forEach(venue => {
      venue.sports?.forEach(sport => sportsSet.add(sport));
    });
    return Array.from(sportsSet).sort();
  }, [venues]);

  // Get all managers for filter
  const allManagers = useMemo(() => {
    const managerIds = new Set<string>();
    venues.forEach(venue => {
      if (venue.managerId) managerIds.add(venue.managerId);
    });
    return Array.from(managerIds).map(id => users.find(u => u.id === id)).filter(Boolean);
  }, [venues, users]);

  // Filter venues
  const filteredVenues = useMemo(() => {
    let filtered = venues;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(venue =>
        venue.name.toLowerCase().includes(query) ||
        venue.address.toLowerCase().includes(query) ||
        venue.id.toLowerCase().includes(query) ||
        venue.sports?.some(sport => sport.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(venue => venue.status === statusFilter);
    }

    // Sport filter
    if (sportFilter !== 'All') {
      filtered = filtered.filter(venue => venue.sports?.includes(sportFilter));
    }

    // Manager filter
    if (managerFilter !== 'All') {
      filtered = filtered.filter(venue => venue.managerId === managerFilter);
    }

    return filtered;
  }, [venues, searchQuery, statusFilter, sportFilter, managerFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredVenues.length / itemsPerPage);
  const paginatedVenues = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVenues.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVenues, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sportFilter, managerFilter]);

  const handleCreateVenue = () => {
    setSelectedVenue(null);
    setIsModalOpen(true);
  };

  // Register "New Entry" handler for Header button
  useEffect(() => {
    if (isSuperAdmin || venues.length === 0) {
      setNewEntryHandler(handleCreateVenue);
      return () => {
        unsetNewEntryHandler();
      };
    }
  }, [isSuperAdmin, venues.length, setNewEntryHandler, unsetNewEntryHandler]);

  const handleEditVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    setIsModalOpen(true);
  };

  const handleSaveVenue = async (venueData: Partial<Venue>) => {
    try {
      setProcessing('saving');

      // Helper function to recursively remove undefined values, empty strings, and empty objects
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return undefined;
        }

        // Treat empty strings as undefined for cleaner data
        if (typeof obj === 'string' && obj.trim() === '') {
          return undefined;
        }

        if (Array.isArray(obj)) {
          const cleaned = obj.map(item => removeUndefined(item)).filter(item => item !== undefined);
          return cleaned.length > 0 ? cleaned : undefined;
        }

        if (typeof obj === 'object') {
          const cleaned: any = {};
          Object.keys(obj).forEach(key => {
            const value = removeUndefined(obj[key]);
            if (value !== undefined) {
              cleaned[key] = value;
            }
          });
          // Return undefined if object is empty after cleaning
          return Object.keys(cleaned).length > 0 ? cleaned : undefined;
        }

        return obj;
      };

      if (selectedVenue) {
        // Update existing venue
        const updateData = removeUndefined(venueData);
        await venuesCollection.update(selectedVenue.id, {
          ...updateData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new venue - generate ID first
        const venueId = `VEN-${Date.now()}`;

        // Clean venueData - remove undefined and managerId (we'll set it separately)
        const { managerId, ...cleanVenueData } = venueData;
        const cleanedData = removeUndefined(cleanVenueData);

        const venuePayload: any = {
          ...cleanedData,
          id: venueId,
          // Initialize payment settings
          paymentSettings: {
            razorpay: {
              enabled: false
            },
            paymentMethods: ['Bank Transfer', 'UPI', 'Cash']
          },
          // Initialize user-related fields
          userIds: [],
          staffIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Only include managerId if user is not super admin and has an ID
        if (!isSuperAdmin && user?.id) {
          venuePayload.managerId = user.id;
        }
        // managerId is NOT included if undefined - it's excluded from the spread

        await venuesCollection.create(venueId, venuePayload);
      }

      setIsModalOpen(false);
      setSelectedVenue(null);
    } catch (error: any) {
      console.error('Error saving venue:', error);
      throw error;
    } finally {
      setProcessing(null);
    }
  };

  const performDeleteVenue = async (venueId: string) => {
    try {
      setProcessing(venueId);
      await venuesCollection.delete(venueId);
      setShowDeleteConfirm(null);
      showSuccess('Venue deleted successfully.');
    } catch (error: any) {
      console.error('Error deleting venue:', error);
      showError('Failed to delete venue: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteVenue = async (venueId: string) => {
    await performDeleteVenue(venueId);
  };

  const handleApproveVenue = async (venueId: string) => {
    try {
      setProcessing(venueId);
      await venuesCollection.update(venueId, {
        status: 'Active',
        updatedAt: serverTimestamp()
      });
      showSuccess('Venue approved successfully.');
    } catch (error: any) {
      console.error('Error approving venue:', error);
      showError('Failed to approve venue: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  if (venuesLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading venues...</p>
        </div>
      </div>
    );
  }

  const handleViewVenue = (venueId: string) => {
    navigate(`/venues/${venueId}`);
  };

  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Venues</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage your sports facilities and court bookings.</p>
        </div>
        {(isSuperAdmin || venues.length === 0) && (
          <button
            onClick={handleCreateVenue}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-xl">add_location_alt</span>
            Add Venue
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="ui-card p-6 flex flex-col justify-between group hover:border-blue-400/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Venues</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{venues.length}</h3>
            </div>
            <div className="bg-blue-50 dark:bg-blue-400/10 p-3 rounded-xl text-blue-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-2xl">domain</span>
            </div>
          </div>
          <div className="text-[10px] font-black mt-4 text-slate-500 uppercase tracking-wider">Registered venues</div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-emerald-400/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Venues</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {venues.filter(v => v.status === 'Active').length}
              </h3>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-400/10 p-3 rounded-xl text-emerald-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
          </div>
          <div className="text-[10px] font-black mt-4 text-emerald-500 uppercase tracking-wider">Available for booking</div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-amber-400/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pending Approval</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {venues.filter(v => v.status === 'Pending').length}
              </h3>
            </div>
            <div className="bg-amber-50 dark:bg-amber-400/10 p-3 rounded-xl text-amber-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-2xl">pending_actions</span>
            </div>
          </div>
          <div className="text-[10px] font-black mt-4 text-amber-600 uppercase tracking-wider">Needs review</div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-purple-400/30 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Courts</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {venues.reduce((sum, v) => sum + (v.courts?.length || 0), 0)}
              </h3>
            </div>
            <div className="bg-purple-50 dark:bg-purple-400/10 p-3 rounded-xl text-purple-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-2xl">sports_tennis</span>
            </div>
          </div>
          <div className="text-[10px] font-black mt-4 text-slate-500 uppercase tracking-wider">Available courts</div>
        </div>
      </div>

      {/* Search and Filters */}
      {/* Search and Filters */}
      <div className="ui-card p-4 overflow-visible">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 px-4 pl-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <span className="material-symbols-outlined text-xl">search</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-black uppercase tracking-tight focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>

            {/* Sport Filter */}
            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-black uppercase tracking-tight focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
            >
              <option value="All">Sport: All</option>
              {allSports.map(sport => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>

            {/* Manager Filter (Super Admin only) */}
            {isSuperAdmin && (
              <select
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-black uppercase tracking-tight focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
              >
                <option value="All">Manager: All</option>
                {allManagers.map(manager => (
                  <option key={manager?.id} value={manager?.id}>{manager?.name || 'Unassigned'}</option>
                ))}
              </select>
            )}

            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex-1 sm:w-10 h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <span className="material-symbols-outlined text-xl">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:w-10 h-9 flex items-center justify-center rounded-lg transition-all ${viewMode === 'list'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <span className="material-symbols-outlined text-xl">view_list</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
        <p>
          Showing <span className="font-bold">{paginatedVenues.length}</span> of{' '}
          <span className="font-bold">{filteredVenues.length}</span> venues
        </p>
        {filteredVenues.length !== venues.length && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setSportFilter('All');
              setManagerFilter('All');
            }}
            className="text-primary hover:text-primary-hover font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {venues.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-slate-600 mb-4">location_off</span>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Venues Found</h3>
          <p className="text-gray-500 dark:text-slate-400 mb-6">Get started by creating your first venue.</p>
          <button
            onClick={handleCreateVenue}
            className="px-6 py-3 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
          >
            Create First Venue
          </button>
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-slate-600 mb-4">search_off</span>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Venues Found</h3>
          <p className="text-gray-500 dark:text-slate-400 mb-6">Try adjusting your search or filters</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setSportFilter('All');
              setManagerFilter('All');
            }}
            className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedVenues.map((venue) => {
            const stats = venueStats.get(venue.id) || { occupancy: 0, revenue: 0 };
            const statusColors = getStatusColor(venue.status);
            const primaryImage = venue.images && venue.images.length > 0 ? venue.images[0] : 'https://via.placeholder.com/400x300?text=No+Image';

            return (
              <div
                key={venue.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden group flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewVenue(venue.id)}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={primaryImage}
                    alt={venue.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                      {venue.status}
                    </span>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">{venue.name}</h3>
                      <p className="text-[10px] font-mono font-bold text-gray-400 dark:text-slate-500">{venue.id.substring(0, 8)}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {venue.address}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50 dark:border-slate-700">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Courts</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">{venue.courts?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Occupancy</p>
                      <p className="text-xl font-black text-primary">{stats.occupancy}%</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Sports</p>
                    <div className="flex flex-wrap gap-2">
                      {venue.sports && venue.sports.length > 0 ? (
                        venue.sports.slice(0, 3).map((sport, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-[10px] font-bold">
                            {sport}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500">No sports</span>
                      )}
                      {venue.sports && venue.sports.length > 3 && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">+{venue.sports.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleViewVenue(venue.id)}
                      className="flex-1 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleEditVenue(venue)}
                      className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Venue</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Sports</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Courts</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Occupancy</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedVenues.map((venue) => {
                const stats = venueStats.get(venue.id) || { occupancy: 0, revenue: 0 };
                const statusColors = getStatusColor(venue.status);
                const manager = users.find(u => u.id === venue.managerId);

                return (
                  <tr key={venue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group" onClick={() => handleViewVenue(venue.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative size-12 shrink-0">
                          {venue.images && venue.images.length > 0 ? (
                            <img
                              src={venue.images[0]}
                              alt={venue.name}
                              className="size-12 rounded-xl object-cover shadow-sm group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="size-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-400">image</span>
                            </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white dark:border-slate-800 ${venue.status === 'Active' ? 'bg-emerald-500' :
                            venue.status === 'Pending' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}></div>
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900 dark:text-white leading-none group-hover:text-primary transition-colors">{venue.name}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[12px]">location_on</span>
                            {venue.address.split(',')[0]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[150px]">
                        {venue.sports && venue.sports.length > 0 ? (
                          venue.sports.slice(0, 2).map((sport, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[9px] font-black uppercase tracking-wider">
                              {sport}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-black text-slate-400">NO DISCIPLINE</span>
                        )}
                        {venue.sports && venue.sports.length > 2 && (
                          <span className="text-[10px] font-black text-slate-400">+{venue.sports.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{venue.courts?.length || 0}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Units</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-primary">{stats.occupancy}%</span>
                        </div>
                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, stats.occupancy)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{manager?.name || 'Automated'}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Primary Org</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewVenue(venue.id)}
                          className="size-8 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                          aria-label="View venue details"
                          title="View venue details"
                        >
                          <span className="material-symbols-outlined text-xl">terminal</span>
                        </button>
                        <button
                          onClick={() => handleEditVenue(venue)}
                          className="size-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          aria-label="Edit venue"
                          title="Edit venue"
                        >
                          <span className="material-symbols-outlined text-xl">settings</span>
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => setShowDeleteConfirm(venue.id)}
                            disabled={processing === venue.id}
                            className="size-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                            aria-label="Delete venue"
                            title="Delete venue"
                          >
                            <span className="material-symbols-outlined text-xl">block</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            Page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${currentPage === pageNum
                      ? 'bg-primary text-white'
                      : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Delete Venue</h3>
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete this venue? This action cannot be undone and will affect all associated bookings and courts.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteVenue(showDeleteConfirm)}
                disabled={processing === showDeleteConfirm}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {processing === showDeleteConfirm ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Venue Form Modal */}
      <VenueFormModal
        venue={selectedVenue}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVenue(null);
        }}
        onSave={handleSaveVenue}
      />

      {/* Court Management Modal */}
      {venueForCourts && (
        <CourtManagementModal
          venue={venueForCourts}
          isOpen={isCourtModalOpen}
          onClose={() => {
            setIsCourtModalOpen(false);
            setVenueForCourts(null);
          }}
        />
      )}

    </div>
  );
};

export default Venues;
