import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVenues } from '../hooks/useVenues';
import { useCourts } from '../hooks/useCourts';
import { courtsCollection } from '../services/firebase';
import { Court, Venue } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import CourtFormModal from '../components/CourtFormModal';
import { serverTimestamp } from 'firebase/firestore';

const CourtManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const venueIdParam = searchParams.get('venueId');
  
  const { user, isSuperAdmin, isVenueManager } = useAuth();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const { venues, loading: venuesLoading } = useVenues({ realtime: true });
  
  // Filter venues for venue managers
  const availableVenues = useMemo(() => {
    if (isSuperAdmin) return venues;
    if (isVenueManager && user?.managedVenues) {
      return venues.filter(v => user.managedVenues?.includes(v.id));
    }
    return [];
  }, [venues, isSuperAdmin, isVenueManager, user?.managedVenues]);

  const [selectedVenueId, setSelectedVenueId] = useState<string>(venueIdParam || availableVenues[0]?.id || '');
  const { courts, loading: courtsLoading } = useCourts({ 
    venueId: selectedVenueId || undefined, 
    realtime: true 
  });
  
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Court['status']>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');

  // Get selected venue
  const selectedVenue = useMemo(() => {
    return venues.find(v => v.id === selectedVenueId);
  }, [venues, selectedVenueId]);

  // Get all unique sports for filter
  const allSports = useMemo(() => {
    const sportsSet = new Set<string>();
    courts.forEach(court => {
      if (court.sport) sportsSet.add(court.sport);
    });
    return Array.from(sportsSet).sort();
  }, [courts]);

  // Filter courts
  const filteredCourts = useMemo(() => {
    let filtered = courts;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(court =>
        court.name.toLowerCase().includes(query) ||
        court.sport?.toLowerCase().includes(query) ||
        court.type?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(court => court.status === statusFilter);
    }

    // Sport filter
    if (sportFilter !== 'All') {
      filtered = filtered.filter(court => court.sport === sportFilter);
    }

    return filtered;
  }, [courts, searchQuery, statusFilter, sportFilter]);

  const handleCreateCourt = () => {
    if (!selectedVenueId) {
      alert('Please select a venue first');
      return;
    }
    setSelectedCourt(null);
    setIsCourtModalOpen(true);
  };

  // Register "New Entry" handler for Header button
  React.useEffect(() => {
    setNewEntryHandler(handleCreateCourt);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler, selectedVenueId]);

  const handleEditCourt = (court: Court) => {
    setSelectedCourt(court);
    setIsCourtModalOpen(true);
  };

  const handleSaveCourt = async (courtData: Partial<Court>) => {
    try {
      setProcessing('saving');
      
      if (selectedCourt) {
        // Update existing court
        await courtsCollection.update(selectedCourt.id, {
          ...courtData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new court
        await courtsCollection.create({
          ...courtData,
          venueId: selectedVenueId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      setIsCourtModalOpen(false);
      setSelectedCourt(null);
    } catch (error: any) {
      console.error('Error saving court:', error);
      throw error;
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteCourt = async (courtId: string) => {
    if (!confirm('Are you sure you want to delete this court? This action cannot be undone.')) {
      return;
    }

    try {
      setProcessing(courtId);
      await courtsCollection.delete(courtId);
    } catch (error: any) {
      console.error('Error deleting court:', error);
      alert('Failed to delete court: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  // Update selectedVenueId when venueIdParam changes
  React.useEffect(() => {
    if (venueIdParam && availableVenues.some(v => v.id === venueIdParam)) {
      setSelectedVenueId(venueIdParam);
    } else if (availableVenues.length > 0 && !selectedVenueId) {
      setSelectedVenueId(availableVenues[0].id);
    }
  }, [venueIdParam, availableVenues, selectedVenueId]);

  if (venuesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading venues...</p>
        </div>
      </div>
    );
  }

  if (availableVenues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">No Venues Available</p>
          <p className="text-gray-600 text-sm mb-4">You need to have access to at least one venue to manage courts.</p>
          <button onClick={() => navigate('/venues')} className="text-primary hover:underline">
            Go to Venues
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Court Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage courts for your venues</p>
        </div>
        {selectedVenueId && (
          <button
            onClick={handleCreateCourt}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Create Court
          </button>
        )}
      </div>

      {/* Venue Selector */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <label className="block text-sm font-black text-gray-700 mb-2">Select Venue</label>
        <select
          value={selectedVenueId}
          onChange={(e) => setSelectedVenueId(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
        >
          {availableVenues.map(venue => (
            <option key={venue.id} value={venue.id}>{venue.name}</option>
          ))}
        </select>
      </div>

      {!selectedVenueId ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">location_on</span>
          <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 mb-2">Select a Venue</h3>
          <p className="text-gray-500">Please select a venue from the dropdown above to manage its courts.</p>
        </div>
      ) : courtsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600 font-medium">Loading courts...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Search and Filters */}
          <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search courts by name, sport, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <span className="material-symbols-outlined">search</span>
                </span>
              </div>

              {/* Status Filter */}
              <div className="md:w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              {/* Sport Filter */}
              <div className="md:w-48">
                <select
                  value={sportFilter}
                  onChange={(e) => setSportFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="All">All Sports</option>
                  {allSports.map(sport => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              Showing <span className="font-bold">{filteredCourts.length}</span> of{' '}
              <span className="font-bold">{courts.length}</span> courts
              {selectedVenue && ` for ${selectedVenue.name}`}
            </p>
            {(searchQuery || statusFilter !== 'All' || sportFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setSportFilter('All');
                }}
                className="text-primary hover:text-primary-hover font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Courts Grid */}
          {filteredCourts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">sports_tennis</span>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {courts.length === 0 ? 'No Courts Added' : 'No Courts Found'}
              </h3>
              <p className="text-gray-500 mb-6">
                {courts.length === 0
                  ? 'Add your first court to start accepting bookings.'
                  : 'Try adjusting your search or filters'}
              </p>
              {courts.length === 0 && (
                <button
                  onClick={handleCreateCourt}
                  className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors"
                >
                  Add First Court
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourts.map((court) => {
                const statusColors = getStatusColor(court.status);
                return (
                  <div
                    key={court.id}
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-gray-900">{court.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {court.sport} {court.type && `• ${court.type}`}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                        {court.status}
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-600">Price per Hour</span>
                        <span className="text-lg font-black text-primary">{formatCurrency(court.pricePerHour)}</span>
                      </div>
                      {court.availability && Object.keys(court.availability).length > 0 && (
                        <div>
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Availability</span>
                          <div className="mt-2 space-y-1">
                            {Object.entries(court.availability).slice(0, 3).map(([day, schedule]) => (
                              <div key={day} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{day.substring(0, 3)}</span>
                                {schedule.available ? (
                                  <span className="text-gray-900 font-bold">
                                    {schedule.start} - {schedule.end}
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-bold">Closed</span>
                                )}
                              </div>
                            ))}
                            {Object.keys(court.availability).length > 3 && (
                              <p className="text-xs text-gray-400">
                                +{Object.keys(court.availability).length - 3} more days
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleEditCourt(court)}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCourt(court.id)}
                        disabled={processing === court.id}
                        className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {processing === court.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Court Form Modal */}
      {selectedVenueId && (
        <CourtFormModal
          court={selectedCourt}
          venueId={selectedVenueId}
          isOpen={isCourtModalOpen}
          onClose={() => {
            setIsCourtModalOpen(false);
            setSelectedCourt(null);
          }}
          onSave={handleSaveCourt}
        />
      )}
    </div>
  );
};

export default CourtManagement;

