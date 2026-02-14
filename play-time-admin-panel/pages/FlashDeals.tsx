import React, { useState, useEffect } from 'react';
import { FlashDeal } from '../types';
import { useFlashDeals } from '../hooks/useFlashDeals';
import { useAuth } from '../contexts/AuthContext';
import { flashDealsCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import FlashDealFormModal from '../components/FlashDealFormModal';
import { formatDate, formatTime } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';

const FlashDeals: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<FlashDeal | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const { deals, loading } = useFlashDeals({
    realtime: true,
    status: statusFilter !== 'All' ? statusFilter as FlashDeal['status'] : undefined,
  });

  // Auto-update status based on current time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      deals.forEach(async (deal) => {
        const startTime = deal.startTime?.toDate();
        const endTime = deal.endTime?.toDate();
        
        if (!startTime || !endTime) return;

        let newStatus: FlashDeal['status'] = deal.status;
        if (now < startTime) {
          newStatus = 'Upcoming';
        } else if (now >= startTime && now <= endTime) {
          newStatus = 'Active';
        } else if (now > endTime) {
          newStatus = 'Expired';
        }

        if (newStatus !== deal.status && deal.status !== 'Cancelled') {
          try {
            await flashDealsCollection.update(deal.id, {
              status: newStatus,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            console.error('Error updating deal status:', error);
          }
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [deals]);

  const filteredDeals = deals.filter(deal => {
    if (statusFilter !== 'All' && deal.status !== statusFilter) return false;
    return true;
  });

  const handleCreateDeal = () => {
    setSelectedDeal(null);
    setShowCreateModal(true);
  };

  const handleEditDeal = (deal: FlashDeal) => {
    setSelectedDeal(deal);
    setShowCreateModal(true);
  };

  const handleSaveDeal = async (dealData: Partial<FlashDeal>) => {
    try {
      setProcessing('saving');

      if (selectedDeal) {
        await flashDealsCollection.update(selectedDeal.id, {
          ...dealData,
          updatedAt: serverTimestamp(),
        });
        showSuccess('Flash deal updated successfully');
      } else {
        await flashDealsCollection.create({
          ...dealData,
          currentBookings: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess('Flash deal created successfully');
      }

      setShowCreateModal(false);
      setSelectedDeal(null);
    } catch (error: any) {
      console.error('Error saving flash deal:', error);
      showError('Failed to save flash deal: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to delete this flash deal?')) {
      return;
    }

    try {
      setProcessing(dealId);
      await flashDealsCollection.delete(dealId);
      showSuccess('Flash deal deleted successfully');
    } catch (error: any) {
      console.error('Error deleting flash deal:', error);
      showError('Failed to delete flash deal: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateStatus = async (dealId: string, newStatus: FlashDeal['status']) => {
    try {
      setProcessing(dealId);
      await flashDealsCollection.update(dealId, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      showSuccess('Status updated successfully');
    } catch (error: any) {
      console.error('Error updating status:', error);
      showError('Failed to update status: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: FlashDeal['status']) => {
    switch (status) {
      case 'Upcoming':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Expired':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'Cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const statuses = ['All', 'Upcoming', 'Active', 'Expired', 'Cancelled'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Flash Deals</h1>
          <p className="text-gray-400 text-sm">Manage time-limited promotional deals</p>
        </div>
        <button
          onClick={handleCreateDeal}
          className="px-6 py-3 bg-primary text-background-dark rounded-xl hover:bg-primary/90 transition-colors font-black text-sm uppercase tracking-wider"
        >
          + New Deal
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-700 bg-surface-dark text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Deals List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center py-12 bg-surface-dark rounded-2xl border border-gray-800">
          <p className="text-gray-400">No flash deals found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeals.map((deal) => {
            const savings = deal.originalPrice - deal.discountedPrice;
            const savingsPercent = ((savings / deal.originalPrice) * 100).toFixed(0);
            
            return (
              <div
                key={deal.id}
                className="bg-surface-dark rounded-2xl p-6 border border-gray-800 hover:border-primary/30 transition-colors"
              >
                {deal.imageUrl && (
                  <div className="mb-4 rounded-xl overflow-hidden">
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-white mb-1">
                      {deal.title}
                    </h3>
                    {deal.venueName && (
                      <p className="text-sm text-gray-400">{deal.venueName}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-black border ${getStatusColor(deal.status)}`}>
                    {deal.status}
                  </span>
                </div>

                {deal.description && (
                  <p className="text-sm text-gray-300 mb-4">{deal.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Original Price:</span>
                    <span className="text-gray-400 line-through">{formatCurrency(deal.originalPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Discounted Price:</span>
                    <span className="text-primary font-black text-lg">{formatCurrency(deal.discountedPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">You Save:</span>
                    <span className="text-green-400 font-black">{formatCurrency(savings)} ({savingsPercent}%)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Bookings:</span>
                    <span className="text-white">
                      {deal.currentBookings} {deal.maxBookings ? `/ ${deal.maxBookings}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Start:</span>
                    <span className="text-white">
                      {deal.startTime ? `${formatDate(deal.startTime.toDate())} ${formatTime(deal.startTime.toDate())}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">End:</span>
                    <span className="text-white">
                      {deal.endTime ? `${formatDate(deal.endTime.toDate())} ${formatTime(deal.endTime.toDate())}` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditDeal(deal)}
                    className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm font-black uppercase tracking-wider"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteDeal(deal.id)}
                    disabled={processing === deal.id}
                    className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    {processing === deal.id ? '...' : 'Delete'}
                  </button>
                </div>

                {/* Quick Status Update */}
                {deal.status !== 'Cancelled' && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <select
                      value={deal.status}
                      onChange={(e) => handleUpdateStatus(deal.id, e.target.value as FlashDeal['status'])}
                      className="w-full px-3 py-2 border border-gray-700 bg-surface-dark text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Active">Active</option>
                      <option value="Expired">Expired</option>
                      <option value="Cancelled">Cancel</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <FlashDealFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedDeal(null);
        }}
        onSave={handleSaveDeal}
        deal={selectedDeal}
      />
    </div>
  );
};

export default FlashDeals;

