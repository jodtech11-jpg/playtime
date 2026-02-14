import React, { useState, useMemo } from 'react';
import { usePayments } from '../hooks/usePayments';
import { useSettlements } from '../hooks/useSettlements';
import { useBookings } from '../hooks/useBookings';
import { useMemberships } from '../hooks/useMemberships';
import { useVenues } from '../hooks/useVenues';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { Payment, Settlement } from '../types';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import SettlementConfirmationModal from '../components/SettlementConfirmationModal';
import { createOfflinePayment } from '../services/paymentService';

const Payments: React.FC = () => {
  const { user, isSuperAdmin, isVenueManager } = useAuth();
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Online' | 'Offline'>('All');
  const [directionFilter, setDirectionFilter] = useState<'All' | 'UserToVenue' | 'VenueToPlatform'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | Payment['status']>('All');
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // Fetch payments based on role
  const paymentOptions = useMemo(() => {
    if (isVenueManager && user?.managedVenues) {
      return {
        venueId: user.managedVenues[0], // For venue managers, show their venue's payments
        realtime: true
      };
    }
    return { realtime: true };
  }, [isVenueManager, user]);

  const { payments, loading: paymentsLoading } = usePayments(paymentOptions);
  const { settlements, loading: settlementsLoading, confirmSettlement } = useSettlements({
    venueId: isVenueManager && user?.managedVenues ? user.managedVenues[0] : undefined,
    realtime: true
  });
  const { venues } = useVenues({ realtime: false });
  const { users } = useUsers({ limit: 100 });

  // Filter payments
  const filteredPayments = useMemo(() => {
    let filtered = payments;

    if (paymentFilter !== 'All') {
      filtered = filtered.filter(p => p.type === paymentFilter);
    }

    if (directionFilter !== 'All') {
      filtered = filtered.filter(p => p.direction === directionFilter);
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    return filtered;
  }, [payments, paymentFilter, directionFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const onlinePayments = payments.filter(p => p.type === 'Online' && p.status === 'Completed');
    const offlinePayments = payments.filter(p => p.type === 'Offline' && p.status === 'Completed');
    const pendingSettlements = settlements.filter(s => s.status === 'Pending');
    const totalOnlineAmount = onlinePayments.reduce((sum, p) => sum + p.amount, 0);
    const totalOfflineAmount = offlinePayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingSettlementAmount = pendingSettlements.reduce((sum, s) => sum + s.amount, 0);

    return {
      onlinePayments: onlinePayments.length,
      offlinePayments: offlinePayments.length,
      pendingSettlements: pendingSettlements.length,
      totalOnlineAmount,
      totalOfflineAmount,
      pendingSettlementAmount
    };
  }, [payments, settlements]);

  const handleConfirmSettlement = async (paymentData: {
    paymentMethod: Settlement['paymentMethod'];
    paymentReference?: string;
    paymentDate: Date;
    receiptUrl?: string;
    confirmedBy: string;
  }) => {
    if (!selectedSettlement || !user) return;
    try {
      // Update settlement status
      await confirmSettlement(selectedSettlement.id, paymentData);
      
      // Create offline payment record
      await createOfflinePayment(selectedSettlement, paymentData);
      
      setShowSettlementModal(false);
      setSelectedSettlement(null);
    } catch (error: any) {
      console.error('Error confirming settlement:', error);
      alert('Failed to confirm settlement: ' + error.message);
    }
  };

  const loading = paymentsLoading || settlementsLoading;

  if (loading && payments.length === 0 && settlements.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-background-light min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Payment Management</h2>
          <p className="text-gray-500 mt-1">
            {isSuperAdmin ? 'Track all online and offline payments across the platform.' : 'View payments for your venues.'}
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: 'Online Payments',
            value: stats.onlinePayments.toString(),
            amount: formatCurrency(stats.totalOnlineAmount),
            color: 'text-green-600',
            bg: 'bg-green-50',
            icon: 'payments'
          },
          {
            label: 'Offline Payments',
            value: stats.offlinePayments.toString(),
            amount: formatCurrency(stats.totalOfflineAmount),
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            icon: 'account_balance_wallet'
          },
          {
            label: 'Pending Settlements',
            value: stats.pendingSettlements.toString(),
            amount: formatCurrency(stats.pendingSettlementAmount),
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            icon: 'pending_actions'
          },
          {
            label: 'Total Revenue',
            value: formatCurrency(stats.totalOnlineAmount + stats.totalOfflineAmount),
            amount: '',
            color: 'text-primary',
            bg: 'bg-primary/10',
            icon: 'trending_up'
          }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`size-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{stat.value}</h4>
            {stat.amount && (
              <p className="text-sm font-bold text-gray-600 mt-1">{stat.amount}</p>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Payment Type</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Types</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Direction</label>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Directions</option>
              <option value="UserToVenue">User → Venue</option>
              <option value="VenueToPlatform">Venue → Platform</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">Payment History</h3>
        </div>
        <div className="overflow-x-auto">
          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">payments</span>
              <p className="text-sm font-medium">No payments found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className="px-8 py-4">Payment ID</th>
                  <th className="px-8 py-4">Type</th>
                  <th className="px-8 py-4">Source</th>
                  <th className="px-8 py-4">Amount</th>
                  <th className="px-8 py-4">Method</th>
                  <th className="px-8 py-4">Transaction ID</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium">
                {filteredPayments.map((payment) => {
                  const venue = venues.find(v => v.id === payment.venueId);
                  const paymentUser = payment.userId ? users.find(u => u.id === payment.userId) : null;
                  const paymentDate = payment.paymentDate?.toDate ? payment.paymentDate.toDate() : (payment.createdAt?.toDate ? payment.createdAt.toDate() : new Date());

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6 font-bold text-gray-400 font-mono text-xs">
                        #{payment.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                          payment.type === 'Online' 
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {payment.type}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div>
                          <p className="font-black text-gray-900 dark:text-gray-100">{venue?.name || 'Unknown Venue'}</p>
                          {paymentUser && (
                            <p className="text-xs text-gray-500">{paymentUser.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 font-black text-gray-900 dark:text-gray-100">{formatCurrency(payment.amount)}</td>
                      <td className="px-8 py-6 text-gray-600 font-semibold">{payment.paymentMethod}</td>
                      <td className="px-8 py-6">
                        {payment.transactionId ? (
                          <span className="font-mono text-xs text-gray-500">{payment.transactionId.substring(0, 20)}...</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                          payment.status === 'Completed' 
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : payment.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : payment.status === 'Failed'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : 'bg-gray-50 text-gray-700 border-gray-100'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-gray-600">
                        <div>
                          <p className="text-xs">{formatDate(paymentDate)}</p>
                          <p className="text-[10px] text-gray-400">{getRelativeTime(paymentDate)}</p>
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

      {/* Settlements Section (Super Admin only) */}
      {isSuperAdmin && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Pending Settlements</h3>
            <p className="text-sm text-gray-500">{settlements.filter(s => s.status === 'Pending').length} pending</p>
          </div>
          <div className="overflow-x-auto">
            {settlements.filter(s => s.status === 'Pending').length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">check_circle</span>
                <p className="text-sm font-medium">No pending settlements</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                    <th className="px-8 py-4">Invoice</th>
                    <th className="px-8 py-4">Venue</th>
                    <th className="px-8 py-4">Amount</th>
                    <th className="px-8 py-4">Due Date</th>
                    <th className="px-8 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm font-medium">
                  {settlements.filter(s => s.status === 'Pending').map((settlement) => {
                    const dueDate = settlement.dueDate?.toDate ? settlement.dueDate.toDate() : new Date();
                    const isOverdue = dueDate < new Date();

                    return (
                      <tr key={settlement.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-6 font-bold text-gray-400 font-mono text-xs">
                          {settlement.invoiceNumber}
                        </td>
                        <td className="px-8 py-6 font-black text-gray-900">{settlement.venueName}</td>
                        <td className="px-8 py-6 font-black text-primary">{formatCurrency(settlement.amount)}</td>
                        <td className="px-8 py-6">
                          <div>
                            <p className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                              {formatDate(dueDate)}
                            </p>
                            {isOverdue && (
                              <p className="text-[10px] text-red-500">Overdue</p>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedSettlement(settlement);
                              setShowSettlementModal(true);
                            }}
                            className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase hover:shadow-lg transition-all"
                          >
                            Confirm Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Settlement Confirmation Modal */}
      <SettlementConfirmationModal
        isOpen={showSettlementModal}
        onClose={() => {
          setShowSettlementModal(false);
          setSelectedSettlement(null);
        }}
        settlement={selectedSettlement}
        onConfirm={handleConfirmSettlement}
      />
    </div>
  );
};

export default Payments;

