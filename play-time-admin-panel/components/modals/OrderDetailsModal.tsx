import React, { useState, useEffect } from 'react';
import { Order } from '../../types';
import { ordersCollection } from '../../services/firebase';
import { formatCurrency } from '../../utils/formatUtils';
import { getRelativeTime } from '../../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onUpdate?: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  onUpdate
}) => {
  const [status, setStatus] = useState<Order['status']>('Pending');
  const [paymentStatus, setPaymentStatus] = useState<Order['paymentStatus']>('Pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState('');
  const { openConfirm, confirmDialog } = useConfirmDialog();

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setPaymentStatus(order.paymentStatus);
      setTrackingNumber(order.trackingNumber || '');
      setCarrier(order.carrier || '');
      setAdminNotes(order.adminNotes || '');
      setNotes(order.notes || '');
      setRefundAmount(order.refundAmount?.toString() || '');
      setRefundReason(order.refundReason || '');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    if (!order) return;
    
    try {
      setLoading(true);
      setError(null);

      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      // Add status history
      const statusHistory = order.statusHistory || [];
      statusHistory.push({
        status: newStatus,
        timestamp: serverTimestamp(),
        note: `Status changed to ${newStatus}`
      });
      updateData.statusHistory = statusHistory;

      // Set timestamps based on status
      if (newStatus === 'Shipped' && !order.shippedAt) {
        updateData.shippedAt = serverTimestamp();
      } else if (newStatus === 'Delivered' && !order.deliveredAt) {
        updateData.deliveredAt = serverTimestamp();
      } else if (newStatus === 'Cancelled' && !order.cancelledAt) {
        updateData.cancelledAt = serverTimestamp();
      }

      await ordersCollection.update(order.id, updateData);
      setStatus(newStatus);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async (newPaymentStatus: Order['paymentStatus']) => {
    if (!order) return;
    
    try {
      setLoading(true);
      setError(null);

      await ordersCollection.update(order.id, {
        paymentStatus: newPaymentStatus,
        updatedAt: serverTimestamp()
      });
      setPaymentStatus(newPaymentStatus);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment status');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTracking = async () => {
    if (!order) return;
    
    try {
      setLoading(true);
      setError(null);

      await ordersCollection.update(order.id, {
        trackingNumber: trackingNumber.trim() || undefined,
        carrier: carrier.trim() || undefined,
        updatedAt: serverTimestamp()
      });
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to save tracking information');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    
    try {
      setLoading(true);
      setError(null);

      await ordersCollection.update(order.id, {
        adminNotes: adminNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        updatedAt: serverTimestamp()
      });
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to save notes');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRefund = () => {
    if (!order) return;

    const refundAmt = parseFloat(refundAmount) || order.total;
    openConfirm({
      title: 'Process refund?',
      message: `Refund ${formatCurrency(refundAmt)} for this order?`,
      variant: 'warning',
      confirmLabel: 'Refund',
      onConfirm: async () => {
        try {
          setLoading(true);
          setError(null);

          if (refundAmt > order.total) {
            throw new Error('Refund amount cannot exceed order total');
          }

          await ordersCollection.update(order.id, {
            paymentStatus: refundAmt === order.total ? 'Refunded' : 'Partially Refunded',
            status: 'Refunded',
            refundAmount: refundAmt,
            refundReason: refundReason.trim() || undefined,
            refundedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (onUpdate) onUpdate();
          setRefundAmount('');
          setRefundReason('');
        } catch (err: any) {
          setError(err.message || 'Failed to process refund');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    if (status === 'Pending' || status === 'Processing') return 'amber';
    if (status === 'Delivered' || status === 'Paid') return 'emerald';
    if (status === 'Cancelled' || status === 'Refunded') return 'red';
    return 'blue';
  };

  const statusOptions: Order['status'][] = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];
  const paymentStatusOptions: Order['paymentStatus'][] = ['Pending', 'Paid', 'Refunded', 'Partially Refunded'];

  return (
    <>
      {confirmDialog}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Order Details</h3>
            <p className="text-sm text-gray-500 mt-1">Order #{order.orderNumber || order.id.substring(0, 8).toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Order Status Section */}
          <div className="bg-gray-50 rounded-xl p-5 space-y-4">
            <h4 className="text-lg font-black text-gray-900">Order Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Order Status
                </label>
                <div className="flex gap-2">
                  <select
                    value={status}
                    onChange={(e) => handleUpdateStatus(e.target.value as Order['status'])}
                    disabled={loading}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {statusOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                    getStatusColor(status) === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    getStatusColor(status) === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    getStatusColor(status) === 'red' ? 'bg-red-50 text-red-700 border-red-100' :
                    'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {status}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Payment Status
                </label>
                <div className="flex gap-2">
                  <select
                    value={paymentStatus}
                    onChange={(e) => handleUpdatePaymentStatus(e.target.value as Order['paymentStatus'])}
                    disabled={loading}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {paymentStatusOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                    paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    paymentStatus === 'Refunded' || paymentStatus === 'Partially Refunded' ? 'bg-red-50 text-red-700 border-red-100' :
                    'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-black text-gray-900 mb-4">Customer Information</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-bold text-gray-600">Name:</span> {order.userName || 'N/A'}</p>
                <p><span className="font-bold text-gray-600">Email:</span> {order.userEmail || 'N/A'}</p>
                <p><span className="font-bold text-gray-600">Phone:</span> {order.userPhone || 'N/A'}</p>
                {order.createdAt && (
                  <p><span className="font-bold text-gray-600">Order Date:</span> {getRelativeTime(order.createdAt)}</p>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <div>
                <h4 className="text-lg font-black text-gray-900 mb-4">Shipping Address</h4>
                <div className="text-sm space-y-1">
                  <p className="font-bold">{order.shippingAddress.name}</p>
                  <p>{order.shippingAddress.address}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</p>
                  <p>Phone: {order.shippingAddress.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div>
            <h4 className="text-lg font-black text-gray-900 mb-4">Order Items</h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Product</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Quantity</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Price</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt={item.productName} className="w-12 h-12 rounded-lg object-cover" />
                          )}
                          <span className="font-medium">{item.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-bold">Subtotal:</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(order.subtotal || order.total)}</td>
                  </tr>
                  {order.discount && order.discount > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right">Discount:</td>
                      <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(order.discount)}</td>
                    </tr>
                  )}
                  {order.shippingCost && order.shippingCost > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right">Shipping:</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(order.shippingCost)}</td>
                    </tr>
                  )}
                  {order.tax && order.tax > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right">Tax:</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(order.tax)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-black text-lg">Total:</td>
                    <td className="px-4 py-3 text-right font-black text-lg text-primary">{formatCurrency(order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tracking Information */}
          <div className="bg-gray-50 rounded-xl p-5 space-y-4">
            <h4 className="text-lg font-black text-gray-900">Shipping Tracking</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter tracking number"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Carrier
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., FedEx, DHL, India Post"
                />
              </div>
            </div>
            <button
              onClick={handleSaveTracking}
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover transition-all disabled:opacity-50"
            >
              Save Tracking Info
            </button>
          </div>

          {/* Notes Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Customer Notes (Visible to customer)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
                placeholder="Notes visible to customer..."
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Admin Notes (Internal only)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
                placeholder="Internal admin notes..."
              />
            </div>
          </div>
          <button
            onClick={handleSaveNotes}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            Save Notes
          </button>

          {/* Refund Section */}
          {order.paymentStatus === 'Paid' && order.status !== 'Refunded' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
              <h4 className="text-lg font-black text-red-900">Process Refund</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Refund Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={order.total.toString()}
                    max={order.total}
                  />
                  <p className="text-xs text-gray-500 mt-1">Max: {formatCurrency(order.total)}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Refund Reason
                  </label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Reason for refund..."
                  />
                </div>
              </div>
              <button
                onClick={handleProcessRefund}
                disabled={loading || !refundAmount}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-all disabled:opacity-50"
              >
                Process Refund
              </button>
            </div>
          )}

          {/* Status History */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div>
              <h4 className="text-lg font-black text-gray-900 mb-4">Status History</h4>
              <div className="space-y-2">
                {order.statusHistory.slice().reverse().map((history, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      getStatusColor(history.status) === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      getStatusColor(history.status) === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      getStatusColor(history.status) === 'red' ? 'bg-red-50 text-red-700 border-red-100' :
                      'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {history.status}
                    </span>
                    <span className="text-sm text-gray-600 flex-1">
                      {history.note || 'Status updated'}
                    </span>
                    {history.timestamp && (
                      <span className="text-xs text-gray-400">
                        {getRelativeTime(history.timestamp)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:bg-primary-hover transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default OrderDetailsModal;

