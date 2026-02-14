import React, { useState } from 'react';
import { Settlement } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';

interface SettlementConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlement: Settlement | null;
  onConfirm: (paymentData: {
    paymentMethod: Settlement['paymentMethod'];
    paymentReference?: string;
    paymentDate: Date;
    receiptUrl?: string;
    confirmedBy: string;
  }) => Promise<void>;
}

const SettlementConfirmationModal: React.FC<SettlementConfirmationModalProps> = ({
  isOpen,
  onClose,
  settlement,
  onConfirm
}) => {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<Settlement['paymentMethod']>('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !settlement || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (paymentMethod !== 'Cash' && !paymentReference.trim()) {
      setError('Please enter payment reference (Transaction ID, UPI ID, etc.)');
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        paymentDate: new Date(paymentDate),
        receiptUrl: receiptUrl.trim() || undefined,
        confirmedBy: user.id
      });
      onClose();
      // Reset form
      setPaymentMethod('Bank Transfer');
      setPaymentReference('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setReceiptUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to confirm payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Confirm Settlement Payment</h3>
            <p className="text-sm text-gray-500 mt-1">Invoice: {settlement.invoiceNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Settlement Details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Venue:</span>
              <span className="text-sm font-black text-gray-900">{settlement.venueName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="text-sm font-black text-primary">{formatCurrency(settlement.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Commission:</span>
              <span className="text-sm font-bold text-gray-700">{formatCurrency(settlement.breakdown.commission)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Convenience Fee:</span>
              <span className="text-sm font-bold text-gray-700">{formatCurrency(settlement.breakdown.convenienceFee)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-black text-gray-900">Net Amount:</span>
              <span className="text-sm font-black text-primary">{formatCurrency(settlement.breakdown.net)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as Settlement['paymentMethod'])}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Payment Reference */}
          {paymentMethod !== 'Cash' && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Payment Reference * {paymentMethod === 'UPI' ? '(UPI Transaction ID)' : paymentMethod === 'Bank Transfer' ? '(Transaction ID/Reference)' : '(Cheque Number)'}
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={paymentMethod === 'UPI' ? 'Enter UPI Transaction ID' : paymentMethod === 'Bank Transfer' ? 'Enter Transaction Reference' : 'Enter Cheque Number'}
                required={paymentMethod !== 'Cash'}
              />
            </div>
          )}

          {/* Payment Date */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Payment Date *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Receipt URL (Optional) */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Receipt URL (Optional)
            </label>
            <input
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com/receipt.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">Upload receipt image to cloud storage and paste URL here</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Confirming...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettlementConfirmationModal;

