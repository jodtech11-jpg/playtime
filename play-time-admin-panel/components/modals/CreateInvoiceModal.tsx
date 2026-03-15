import React, { useState, useEffect, useMemo } from 'react';
import { Invoice } from '../../types';
import { useBookings } from '../../hooks/useBookings';
import { useMemberships } from '../../hooks/useMemberships';
import { useVenues } from '../../hooks/useVenues';
import { useUsers } from '../../hooks/useUsers';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate } from '../../utils/dateUtils';
import { generateInvoicePDFFile, getInvoiceVenueName } from '../../services/invoiceService';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const PLATFORM_COMMISSION_RATE = 0.05; // 5%
const CONVENIENCE_FEE = 100; // ₹100

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [invoiceType, setInvoiceType] = useState<'Booking' | 'Membership' | 'Commission' | 'Settlement'>('Booking');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [gross, setGross] = useState<string>('');
  const [commission, setCommission] = useState<string>('');
  const [convenienceFee, setConvenienceFee] = useState<string>('');
  const [gatewayFee, setGatewayFee] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Paid' | 'Cancelled'>('Draft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const { bookings } = useBookings({ realtime: false });
  const { memberships } = useMemberships({ realtime: false });
  const { venues } = useVenues({ realtime: false });
  const { users } = useUsers({ limit: 100 });

  // Filter bookings and memberships for selection
  const availableBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'Confirmed' && b.paymentStatus === 'Paid');
  }, [bookings]);

  const availableMemberships = useMemo(() => {
    return memberships.filter(m => m.status === 'Active');
  }, [memberships]);

  // Calculate breakdown when booking/membership is selected
  useEffect(() => {
    if (invoiceType === 'Booking' && selectedBookingId) {
      const booking = availableBookings.find(b => b.id === selectedBookingId);
      if (booking) {
        const bookingAmount = booking.amount || 0;
        const calculatedCommission = bookingAmount * PLATFORM_COMMISSION_RATE;
        const calculatedConvenienceFee = CONVENIENCE_FEE;
        const calculatedGatewayFee = calculatedCommission * 0.06; // 6% of commission
        const net = calculatedCommission + calculatedConvenienceFee - calculatedGatewayFee;

        setGross(bookingAmount.toString());
        setCommission(calculatedCommission.toString());
        setConvenienceFee(calculatedConvenienceFee.toString());
        setGatewayFee(calculatedGatewayFee.toString());
        setAmount(net.toString());
        setSelectedSourceId(booking.venueId);
      }
    } else if (invoiceType === 'Membership' && selectedMembershipId) {
      const membership = availableMemberships.find(m => m.id === selectedMembershipId);
      if (membership) {
        const membershipAmount = membership.price;
        const calculatedCommission = membershipAmount * PLATFORM_COMMISSION_RATE;
        const calculatedGatewayFee = calculatedCommission * 0.06;
        const net = calculatedCommission - calculatedGatewayFee;

        setGross(membershipAmount.toString());
        setCommission(calculatedCommission.toString());
        setConvenienceFee('0');
        setGatewayFee(calculatedGatewayFee.toString());
        setAmount(net.toString());
        setSelectedSourceId(membership.venueId);
      }
    } else if (invoiceType === 'Commission' || invoiceType === 'Settlement') {
      // Manual entry for Commission/Settlement
      setGross('');
      setCommission('');
      setConvenienceFee('');
      setGatewayFee('');
      setAmount('');
    }
  }, [invoiceType, selectedBookingId, selectedMembershipId, availableBookings, availableMemberships]);

  // Get source name
  const sourceName = useMemo(() => {
    if (invoiceType === 'Booking' && selectedBookingId) {
      const booking = availableBookings.find(b => b.id === selectedBookingId);
      const venue = venues.find(v => v.id === booking?.venueId);
      return venue?.name || booking?.venueId || '';
    } else if (invoiceType === 'Membership' && selectedMembershipId) {
      const membership = availableMemberships.find(m => m.id === selectedMembershipId);
      const venue = venues.find(v => v.id === membership?.venueId);
      return venue?.name || membership?.venueId || '';
    } else if (selectedSourceId) {
      const venue = venues.find(v => v.id === selectedSourceId);
      return venue?.name || selectedSourceId;
    }
    return '';
  }, [invoiceType, selectedBookingId, selectedMembershipId, selectedSourceId, venues, availableBookings, availableMemberships]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const grossAmount = parseFloat(gross) || 0;
      const commissionAmount = parseFloat(commission) || 0;
      const convenienceFeeAmount = parseFloat(convenienceFee) || 0;
      const gatewayFeeAmount = parseFloat(gatewayFee) || 0;
      const netAmount = parseFloat(amount) || 0;

      // Derive sourceId: for Booking/Membership it may come from the item's venueId
      const resolvedSourceId = selectedSourceId
        || (invoiceType === 'Booking' ? availableBookings.find(b => b.id === selectedBookingId)?.venueId : undefined)
        || (invoiceType === 'Membership' ? availableMemberships.find(m => m.id === selectedMembershipId)?.venueId : undefined)
        || '';

      if (!resolvedSourceId) {
        throw new Error('Please select a venue/source for this invoice');
      }

      if (invoiceType === 'Booking' && !selectedBookingId) {
        throw new Error('Please select a booking');
      }

      if (invoiceType === 'Membership' && !selectedMembershipId) {
        throw new Error('Please select a membership');
      }

      const invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
        invoiceNumber: '', // Will be generated in createInvoice
        type: invoiceType,
        source: sourceName,
        sourceId: invoiceType === 'Booking' ? selectedBookingId : invoiceType === 'Membership' ? selectedMembershipId : resolvedSourceId,
        amount: netAmount,
        breakdown: {
          gross: grossAmount,
          commission: commissionAmount > 0 ? commissionAmount : 0,
          convenienceFee: convenienceFeeAmount > 0 ? convenienceFeeAmount : 0,
          gatewayFee: gatewayFeeAmount > 0 ? gatewayFeeAmount : 0,
          net: netAmount
        },
        status,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {})
      };

      await onCreate(invoiceData);

      // Reset form
      setInvoiceType('Booking');
      setSelectedSourceId('');
      setSelectedBookingId('');
      setSelectedMembershipId('');
      setAmount('');
      setGross('');
      setCommission('');
      setConvenienceFee('');
      setGatewayFee('');
      setDueDate('');
      setStatus('Draft');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!gross || !amount) {
      setError('Please fill in all required fields before generating PDF');
      return;
    }

    try {
      const grossAmount = parseFloat(gross) || 0;
      const commissionAmount = parseFloat(commission) || 0;
      const convenienceFeeAmount = parseFloat(convenienceFee) || 0;
      const gatewayFeeAmount = parseFloat(gatewayFee) || 0;
      const netAmount = parseFloat(amount) || 0;

      const tempInvoice: Invoice = {
        id: 'temp',
        invoiceNumber: `PREVIEW-${Date.now()}`,
        type: invoiceType,
        source: sourceName,
        sourceId: selectedSourceId,
        amount: netAmount,
        breakdown: {
          gross: grossAmount,
          commission: commissionAmount > 0 ? commissionAmount : undefined,
          convenienceFee: convenienceFeeAmount > 0 ? convenienceFeeAmount : undefined,
          gatewayFee: gatewayFeeAmount > 0 ? gatewayFeeAmount : undefined,
          net: netAmount,
        },
        status: status,
        createdAt: new Date(),
      };

      const venueName = getInvoiceVenueName(tempInvoice, venues);
      await generateInvoicePDFFile(tempInvoice, venueName);
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                Create Invoice
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Generate new financial records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <form id="invoice-form" onSubmit={handleSubmit} className="space-y-10">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-5 py-4 rounded-xl text-xs font-bold flex items-center gap-3">
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            {/* Classification */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-primary"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Invoice Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Service Type</label>
                  <div className="relative">
                    <select
                      value={invoiceType}
                      onChange={(e) => {
                        setInvoiceType(e.target.value as any);
                        setSelectedBookingId('');
                        setSelectedMembershipId('');
                        setSelectedSourceId('');
                        setAmount('');
                        setGross('');
                        setCommission('');
                        setConvenienceFee('');
                        setGatewayFee('');
                      }}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                    >
                      <option value="Booking">Booking Record</option>
                      <option value="Membership">Membership Record</option>
                      <option value="Commission">Platform Commission</option>
                      <option value="Settlement">Venue Settlement</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Processing Status</label>
                  <div className="relative">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Paid">Paid</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Source Origin */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-blue-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Source Selection</h3>
              </div>

              {invoiceType === 'Booking' && (
                <div className="relative">
                  <select
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                  >
                    <option value="">Select Booking...</option>
                    {availableBookings.map(booking => {
                      const venue = venues.find(v => v.id === booking.venueId);
                      return (
                        <option key={booking.id} value={booking.id}>
                          {venue?.name || booking.venueId} — {formatCurrency(booking.amount || 0)} — {formatDate(booking.startTime)}
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">receipt</span>
                </div>
              )}

              {invoiceType === 'Membership' && (
                <div className="relative">
                  <select
                    value={selectedMembershipId}
                    onChange={(e) => setSelectedMembershipId(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                  >
                    <option value="">Select Membership...</option>
                    {availableMemberships.map(membership => {
                      const venue = venues.find(v => v.id === membership.venueId);
                      return (
                        <option key={membership.id} value={membership.id}>
                          {venue?.name || membership.venueId} — {formatCurrency(membership.price)} — {membership.planName}
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">card_membership</span>
                </div>
              )}

              {(invoiceType === 'Commission' || invoiceType === 'Settlement') && (
                <div className="relative">
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                  >
                    <option value="">Select Venue...</option>
                    {venues.map(venue => (
                      <option key={venue.id} value={venue.id}>{venue.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">business</span>
                </div>
              )}
            </section>

            {/* Fiscal Breakdown */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-emerald-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Financial Breakdown</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="ui-card p-4 bg-slate-50 dark:bg-slate-800/30 border-dashed">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Gross Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gross}
                    onChange={(e) => setGross(e.target.value)}
                    className="w-full bg-transparent text-sm font-black text-slate-900 dark:text-white border-none focus:ring-0 p-0 placeholder:text-slate-300"
                    placeholder="0.00"
                    disabled={invoiceType === 'Booking' || invoiceType === 'Membership'}
                  />
                </div>
                <div className="ui-card p-4 bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30">
                  <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Platform Comm (5%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    className="w-full bg-transparent text-sm font-black text-indigo-600 dark:text-indigo-400 border-none focus:ring-0 p-0 placeholder:text-indigo-200"
                    placeholder="0.00"
                    disabled={invoiceType === 'Booking' || invoiceType === 'Membership'}
                  />
                </div>
                <div className="ui-card p-4 bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
                  <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-2">Convenience Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    value={convenienceFee}
                    onChange={(e) => setConvenienceFee(e.target.value)}
                    className="w-full bg-transparent text-sm font-black text-emerald-600 dark:text-emerald-400 border-none focus:ring-0 p-0 placeholder:text-emerald-200"
                    placeholder="0.00"
                    disabled={invoiceType === 'Booking' || invoiceType === 'Membership'}
                  />
                </div>
                <div className="ui-card p-4 bg-rose-50/30 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30">
                  <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-2">Processing Fee (6%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gatewayFee}
                    onChange={(e) => setGatewayFee(e.target.value)}
                    className="w-full bg-transparent text-sm font-black text-rose-600 dark:text-rose-400 border-none focus:ring-0 p-0 placeholder:text-rose-200"
                    placeholder="0.00"
                    disabled={invoiceType === 'Booking' || invoiceType === 'Membership'}
                  />
                </div>
              </div>

              <div className="ui-card p-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-none flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Net Platform Revenue</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-black tracking-tighter">{amount ? formatCurrency(parseFloat(amount) || 0) : '₹0.00'}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-white/10 dark:bg-slate-900/10 px-2 py-0.5 rounded-full border border-white/20 dark:border-slate-900/20">Final Amount</span>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-transparent text-right text-sm font-black border-none focus:ring-0 w-32 placeholder:text-white/30 dark:placeholder:text-slate-900/30"
                  placeholder="0.00"
                  required
                />
              </div>
            </section>

            {/* Constraints */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-slate-400"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Schedule & Deadline</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Due Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white"
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">calendar_today</span>
                </div>
              </div>
            </section>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-8 py-6 flex gap-4">
          <button
            type="button"
            onClick={handleGeneratePDF}
            disabled={!gross || !amount}
            className="px-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
            Preview Document
          </button>
          <div className="flex-1 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="invoice-form"
              disabled={loading}
              className="flex-[2] bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="size-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">publish</span>
              )}
              {loading ? 'Processing...' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;

