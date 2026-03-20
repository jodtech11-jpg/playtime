import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVenues } from '../hooks/useVenues';
import { useBookings } from '../hooks/useBookings';
import { useCourts } from '../hooks/useCourts';
import { useUsers } from '../hooks/useUsers';
import { venuesCollection } from '../services/firebase';
import { Venue } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import VenueFormModal from '../components/modals/VenueFormModal';
import { serverTimestamp } from 'firebase/firestore';

const VenueDetail: React.FC = () => {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin, isVenueManager } = useAuth();
  const { showSuccess, showError } = useToast();

  const { venues, loading: venuesLoading } = useVenues({ realtime: true });
  const venue = venues.find(v => v.id === venueId);

  const { bookings, loading: bookingsLoading } = useBookings({ venueId: venueId, realtime: true });
  const { courts, loading: courtsLoading } = useCourts({ venueId: venueId, realtime: true });
  const { users } = useUsers({ limit: 100 });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Filter bookings for venue managers (empty managedVenues must not show all bookings)
  const filteredBookings = useMemo(() => {
    if (!isVenueManager) return bookings;
    const allowed = currentUser?.managedVenues?.filter(Boolean) ?? [];
    if (allowed.length === 0) return [];
    return bookings.filter(b => allowed.includes(b.venueId));
  }, [bookings, isVenueManager, currentUser?.managedVenues]);

  const manager = useMemo(() => {
    return users.find(u => u.id === venue?.managerId);
  }, [users, venue?.managerId]);

  const stats = useMemo(() => {
    const confirmedBookings = filteredBookings.filter(b => b.status === 'Confirmed');
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalBookings = filteredBookings.length;
    const activeCourts = courts.filter(c => c.status === 'Active').length;

    return {
      totalRevenue,
      totalBookings,
      activeCourts,
      totalCourts: courts.length
    };
  }, [filteredBookings, courts]);

  const handleSaveVenue = async (venueData: Partial<Venue>) => {
    if (!venueId) return;
    try {
      setProcessing('saving');
      await venuesCollection.update(venueId, {
        ...venueData,
        updatedAt: serverTimestamp()
      });
      setIsEditModalOpen(false);
      setProcessing(null);
      showSuccess('Venue updated successfully.');
    } catch (err: any) {
      console.error('Error saving venue:', err);
      setProcessing(null);
      showError(`Failed to save venue: ${err.message}`);
    }
  };

  const canEditVenue = isSuperAdmin || (isVenueManager && currentUser?.managedVenues?.includes(venueId || ''));

  if (venuesLoading || bookingsLoading || courtsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading venue details...</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Venue not found</p>
          <p className="text-gray-600 text-sm mb-4">The venue you're looking for doesn't exist or has been deleted.</p>
          <button onClick={() => navigate('/venues')} className="text-primary hover:underline">
            Back to Venues
          </button>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(venue.status);
  const primaryImage = venue.images && venue.images.length > 0 ? venue.images[0] : 'https://via.placeholder.com/800x400?text=No+Image';

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-10 bg-slate-50 dark:bg-slate-900 min-h-full">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
        <button onClick={() => navigate('/venues')} className="hover:text-primary transition-colors">
          Venues
        </button>
        <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
        <span className="text-slate-700 dark:text-slate-200 truncate max-w-xs">{venue.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/venues')}
            aria-label="Back to venues"
            className="size-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 transition-all shadow-sm group"
          >
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{venue.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">{venue.address}</p>
          </div>
        </div>
        {canEditVenue && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">edit_square</span>
            Edit Venue
          </button>
        )}
      </div>

      {/* Hero Image and Status */}
      <div className="relative h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl group">
        <img
          src={primaryImage}
          alt={venue.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
        <div className="absolute bottom-6 left-6">
          <div className="flex items-center gap-3">
            <div className="size-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-black text-white uppercase tracking-[0.2em]">Active Facility</span>
          </div>
        </div>
        <div className="absolute top-6 right-6">
          <div className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl border border-white/20 shadow-2xl ${venue.status === 'Active' ? 'bg-emerald-500/80 text-white' : 'bg-slate-500/80 text-white'
            }`}>
            {venue.status}
          </div>
        </div>
      </div>
      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="ui-card p-6 flex flex-col justify-between group hover:border-emerald-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">REVENUE</span>
          </div>
          <div className="mt-8">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Lifetime income</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-blue-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">confirmation_number</span>
            </div>
            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-none">BOOKINGS</span>
          </div>
          <div className="mt-8">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.totalBookings}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Total completed</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-primary/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">apps</span>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">COURTS</span>
          </div>
          <div className="mt-8">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{stats.activeCourts} / {stats.totalCourts}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Currently active</p>
          </div>
        </div>

        <div className="ui-card p-6 flex flex-col justify-between group hover:border-slate-400/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">fingerprint</span>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">VENUE ID</span>
          </div>
          <div className="mt-8 overflow-hidden">
            <p className="text-xs font-black text-slate-900 dark:text-white truncate">{venue.id}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2">Database ID</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="ui-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-5 w-1 rounded-full bg-primary"></div>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Facility Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-xl">location_on</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Location</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-1.5">{venue.address}</p>
                  </div>
                </div>

                {venue.phone && (
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-xl">call</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Contact</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-1.5">{venue.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {venue.email && (
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-xl">mail</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Email Address</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-1.5">{venue.email}</p>
                    </div>
                  </div>
                )}

                {venue.website && (
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-xl">public</span>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Website</p>
                      <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-primary hover:underline mt-1.5 block">
                        {venue.website.replace('https://', '').replace('http://', '')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {venue.description && (
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3">Description</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">{venue.description}</p>
              </div>
            )}
          </div>

          {/* Sports Supported */}
          <div className="ui-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-5 w-1 rounded-full bg-amber-500"></div>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Sports & Activities</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {venue.sports && venue.sports.length > 0 ? (
                venue.sports.map((sport, idx) => (
                  <div key={idx} className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3 transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-amber-400/40 group">
                    <span className="material-symbols-outlined text-amber-500 text-sm">sports_score</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                      {sport}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No sports added</p>
              )}
            </div>
          </div>

          {/* Amenities */}
          {venue.amenities && venue.amenities.length > 0 && (
            <div className="ui-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-5 w-1 rounded-full bg-emerald-500"></div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Amenities</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {venue.amenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 group hover:bg-white dark:hover:bg-slate-800 transition-all border-l-4 border-l-emerald-500/30">
                    <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images Gallery */}
          {venue.images && venue.images.length > 0 && (
            <div className="ui-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-5 w-1 rounded-full bg-indigo-500"></div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Photos</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {venue.images.map((image, idx) => (
                  <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-pointer relative shadow-sm hover:shadow-xl transition-all">
                    <img
                      src={image}
                      alt={`${venue.name} - Photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <p className="text-[8px] font-black text-white uppercase tracking-widest">View Photo {idx + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Bookings */}
          <div className="ui-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-blue-500"></div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Recent Bookings</h2>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">Live Updates</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Court</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filteredBookings.slice(0, 5).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No bookings found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.slice(0, 5).map((booking) => (
                      <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest group-hover:text-primary transition-colors">{booking.court}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-bold">
                          {formatDate(booking.startTime.toDate())}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-slate-900 dark:text-white">
                          {formatCurrency(booking.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${booking.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            booking.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                            {booking.status}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 sm:space-y-8">
          {/* Manager Info */}
          <div className="ui-card p-6 group">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-5 w-1 rounded-full bg-indigo-500"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Venue Manager</h3>
            </div>
            {manager ? (
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-0.5 border border-slate-200 dark:border-slate-700 overflow-hidden group-hover:scale-110 transition-transform">
                  <img
                    src={manager.avatar || `https://ui-avatars.com/api/?name=${manager.name}&background=6366f1&color=fff&size=64`}
                    alt={manager.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{manager.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-2">{manager.email}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unassigned</p>
              </div>
            )}
          </div>

          {/* Courts Summary */}
          <div className="ui-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1 rounded-full bg-emerald-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Courts</h3>
              </div>
              <button
                onClick={() => navigate(`/venues/courts?venueId=${venueId}`)}
                className="size-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-primary transition-all border border-transparent hover:border-slate-200"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
              </button>
            </div>
            <div className="space-y-3">
              {courts.length === 0 ? (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-4">No courts added</p>
              ) : (
                courts.slice(0, 5).map((court) => (
                  <div key={court.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-emerald-400/30 transition-all group">
                    <div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest group-hover:text-primary transition-colors">{court.name}</p>
                      <p className="text-[9px] font-bold text-slate-500 mt-1">{court.sport}</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${court.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                      {court.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment Settings */}
          {venue.paymentSettings && (
            <div className="ui-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-5 w-1 rounded-full bg-blue-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Payments</h3>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-500 text-lg">account_balance</span>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Razorpay</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${venue.paymentSettings.razorpay?.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                    {venue.paymentSettings.razorpay?.enabled ? 'ENABLED' : 'DISABLED'}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Methods</p>
                  <div className="flex flex-wrap gap-2">
                    {venue.paymentSettings.paymentMethods?.map((method, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="ui-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-5 w-1 rounded-full bg-slate-500"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Activity info</h3>
            </div>
            <div className="space-y-6">
              {venue.createdAt && (
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-lg">event_note</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Added on</p>
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white mt-1.5">{formatDate(venue.createdAt.toDate())}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{getRelativeTime(venue.createdAt.toDate())}</p>
                  </div>
                </div>
              )}
              {venue.updatedAt && (
                <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-lg">update</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Last updated</p>
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white mt-1.5">{formatDate(venue.updatedAt.toDate())}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{getRelativeTime(venue.updatedAt.toDate())}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && venue && (
        <VenueFormModal
          venue={venue}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveVenue}
        />
      )}

    </div>
  );
};

export default VenueDetail;

