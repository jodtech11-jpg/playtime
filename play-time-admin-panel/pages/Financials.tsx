import React, { useState, useMemo } from 'react';
import { useFinancials } from '../hooks/useFinancials';
import { useVenues } from '../hooks/useVenues';
import { useInvoices } from '../hooks/useInvoices';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import { exportTransactionsToCSV, exportFinancialReportToPDF, generateInvoicePDF } from '../utils/exportUtils';
import { generateInvoicePDFFile, getInvoiceVenueName } from '../services/invoiceService';
import CreateInvoiceModal from '../components/modals/CreateInvoiceModal';
import { Invoice } from '../types';

const Financials: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [filterType, setFilterType] = useState<'All' | 'Bookings' | 'Memb' | 'Equip'>('All');
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
  const { createInvoice, invoices, loading: invoicesLoading } = useInvoices(true);

  // Calculate date range
  const dateRangeObj = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateRange) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Start of week
        return {
          start: weekStart,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          start: monthStart,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      default:
        return undefined;
    }
  }, [dateRange]);

  const { metrics, transactions, loading } = useFinancials({
    dateRange: dateRangeObj,
    realtime: true
  });

  const { venues } = useVenues({ realtime: true });

  // Filter transactions by type
  const filteredTransactions = useMemo(() => {
    if (filterType === 'All') return transactions;
    if (filterType === 'Bookings') return transactions.filter(t => t.type === 'Booking');
    if (filterType === 'Memb') return transactions.filter(t => t.type === 'Membership');
    return transactions.filter(t => t.type === 'Equipment');
  }, [transactions, filterType]);

  // Calculate fee settlement
  const settlement = useMemo(() => {
    const commissionCollected = metrics.platformCommission;
    const gatewayFees = commissionCollected * 0.06; // 6% of commission (estimated)
    const settledToPlatform = commissionCollected + metrics.convenienceFees - gatewayFees;

    return {
      commissionCollected,
      gatewayFees,
      settledToPlatform
    };
  }, [metrics]);

  const handleExportCSV = () => {
    try {
      exportTransactionsToCSV(filteredTransactions);
      showSuccess('Financial report exported to CSV successfully!');
    } catch (error: any) {
      console.error('Export error:', error);
      showError('Failed to export CSV. Please try again.');
    }
  };

  const handleExportPDF = () => {
    try {
      exportFinancialReportToPDF(filteredTransactions, metrics, 'Financial Report');
      showSuccess('Financial report exported to PDF successfully!');
    } catch (error: any) {
      console.error('Export error:', error);
      showError('Failed to export PDF. Please try again.');
    }
  };

  const handleCreateInvoice = async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createInvoice(invoiceData);
  };

  const handleExecuteSettlement = async () => {
    if (!user) {
      setSettlementError('You must be logged in to execute settlement');
      return;
    }

    if (!settlement.settledToPlatform || settlement.settledToPlatform <= 0) {
      setSettlementError('No amount to settle. Settlement amount must be greater than 0.');
      return;
    }

    setSettlementLoading(true);
    setSettlementError(null);

    try {
      // Create a settlement invoice
      const settlementInvoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
        invoiceNumber: '', // Will be auto-generated
        type: 'Settlement',
        source: 'Play Time Platform',
        sourceId: 'platform',
        amount: settlement.settledToPlatform,
        breakdown: {
          gross: settlement.commissionCollected + metrics.convenienceFees,
          commission: settlement.commissionCollected,
          convenienceFee: metrics.convenienceFees,
          gatewayFee: settlement.gatewayFees,
          net: settlement.settledToPlatform
        },
        status: 'Paid',
        paidDate: new Date()
      };

      await createInvoice(settlementInvoice);

      // Show success message
      alert(`Settlement executed successfully!\n\nAmount: ${formatCurrency(settlement.settledToPlatform)}\nCommission: ${formatCurrency(settlement.commissionCollected)}\nConvenience Fees: ${formatCurrency(metrics.convenienceFees)}\nGateway Fees: ${formatCurrency(settlement.gatewayFees)}`);

      setShowSettlementConfirm(false);
    } catch (err: any) {
      console.error('Error executing settlement:', err);
      setSettlementError(err.message || 'Failed to execute settlement. Please try again.');
    } finally {
      setSettlementLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-xl h-12 w-12 border-4 border-primary/30 border-t-primary mb-6"></div>
          <p className="text-slate-500 font-extrabold uppercase tracking-widest text-[10px]">Processing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-slate-50 dark:bg-slate-900 min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">Financials</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">Track platform revenue, payments, and settlements.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {['all', 'today', 'week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range as any)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === range
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="relative group">
            <button
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm transition-all hover:border-primary/40"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Export Data
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[200px] py-1">
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-lg">description</span>
                CSV Spreadsheet
              </button>
              <button
                onClick={handleExportPDF}
                className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                PDF Document
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowCreateInvoiceModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">add_notes</span>
            Create Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Total Bookings",
            val: formatCurrency(metrics.grossBookingValue),
            sub: "Total amount from all bookings",
            trend: metrics.revenueTrend > 0 ? `+${metrics.revenueTrend.toFixed(1)}%` : undefined,
            icon: "account_balance",
            color: "text-slate-600",
            bg: "bg-slate-100 dark:bg-slate-800"
          },
          {
            label: "Platform Earnings",
            val: formatCurrency(metrics.platformCommission),
            sub: "Total commission from venues",
            icon: "percent",
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
          },
          {
            label: "Convenience Fees",
            val: formatCurrency(metrics.convenienceFees),
            sub: "Total from convenience fees",
            icon: "strikethrough_s",
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            badge: "Operational Asset"
          },
          {
            label: "Pending Payouts",
            val: formatCurrency(metrics.pendingVenuePayouts),
            sub: "Amount to be paid to venues",
            icon: "payments",
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20",
            badge: `${venues.length} Facilities`
          }
        ].map((s, i) => (
          <div key={i} className="ui-card p-6 flex flex-col justify-between group hover:border-slate-400/40 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className={`size-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}>
                <span className="material-symbols-outlined text-xl">{s.icon}</span>
              </div>
              {s.badge ? (
                <span className="text-[8px] font-black uppercase text-slate-400 border border-slate-100 dark:border-slate-700 px-2 py-0.5 rounded-full">{s.badge}</span>
              ) : s.trend && (
                <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[10px]">trending_up</span>
                  {s.trend}
                </div>
              )}
            </div>
            <div className="mt-8">
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] leading-none mb-3">{s.label}</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{s.val}</h3>
              <p className="text-[10px] font-bold text-slate-500 mt-3">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-10">
          {/* Transaction Ledger */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-blue-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Transactions</h3>
              </div>
              <div className="flex gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                {['All', 'Bookings', 'Memberships', 'Payments'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType((f === 'Memberships' ? 'Memb' : f === 'Payments' ? 'Equip' : f) as any)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${((filterType === 'Memb' && f === 'Memberships') || (filterType === 'Equip' && f === 'Payments') || (filterType === f))
                      ? 'bg-primary text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="ui-card overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="p-20 text-center">
                  <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 mb-6">receipt_long</span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No transactions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-4">Reference</th>
                        <th className="px-6 py-4">Source</th>
                        <th className="px-6 py-4">Fees</th>
                        <th className="px-6 py-4">Our Share</th>
                        <th className="px-6 py-4 text-center">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredTransactions.slice(0, 20).map((t) => (
                        <React.Fragment key={t.id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer group" onClick={() => setSelectedTransactionId(selectedTransactionId === t.id ? null : t.id)}>
                            <td className="px-6 py-5">
                              <span className="font-mono font-black text-slate-400 group-hover:text-primary transition-colors">{t.invoiceId || `#${t.id.substring(0, 8).toUpperCase()}`}</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                                  {t.source[0]}
                                </div>
                                <span className="font-black text-slate-900 dark:text-white uppercase tracking-widest">{t.source}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex gap-2">
                                {t.convenienceFee && t.convenienceFee > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                                    Fee: {formatCurrency(t.convenienceFee)}
                                  </span>
                                )}
                                {t.platformCommission && t.platformCommission > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">
                                    Comm: {((t.platformCommission / t.amount) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5 font-black text-slate-900 dark:text-white">{formatCurrency(t.netPlatform || 0)}</td>
                            <td className="px-6 py-5 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedTransactionId(selectedTransactionId === t.id ? null : t.id); }}
                                className={`size-8 rounded-lg border transition-all ${selectedTransactionId === t.id ? 'bg-primary text-white border-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary hover:border-primary/30 border-transparent'}`}
                              >
                                <span className="material-symbols-outlined text-lg">info</span>
                              </button>
                            </td>
                          </tr>
                          {selectedTransactionId === t.id && (
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                              <td colSpan={5} className="px-6 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</p>
                                    <p className="font-black text-slate-900 dark:text-white">{t.type}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Amount</p>
                                    <p className="font-black text-slate-900 dark:text-white">{formatCurrency(t.amount)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Venue Payout</p>
                                    <p className="font-black text-slate-900 dark:text-white">{formatCurrency(t.venuePayout || 0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : t.status === 'Refunded' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span>
                                  </div>
                                  {t.bookingId && (
                                    <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Booking ID</p>
                                      <p className="font-mono text-slate-500">{t.bookingId}</p>
                                    </div>
                                  )}
                                  {t.membershipId && (
                                    <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Membership ID</p>
                                      <p className="font-mono text-slate-500">{t.membershipId}</p>
                                    </div>
                                  )}
                                  {t.createdAt && (
                                    <div>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                                      <p className="font-black text-slate-900 dark:text-white">{formatDate(t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt))}</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Invoices Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-1 rounded-full bg-primary"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Invoices</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                {invoices.length} Active Records
              </span>
            </div>

            <div className="ui-card overflow-hidden">
              {invoicesLoading ? (
                <div className="p-20 text-center">
                  <div className="inline-block animate-spin rounded-xl h-10 w-10 border-4 border-primary/20 border-t-primary mb-6"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading records...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-20 text-center">
                  <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 mb-6">folder_off</span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No invoice records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-4">Invoice #</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Entity</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-600 dark:text-slate-400">
                      {invoices.map((invoice) => {
                        const venueName = getInvoiceVenueName(invoice, venues);
                        const statusColors: Record<string, string> = {
                          'Draft': 'bg-slate-100 text-slate-600 border-slate-200',
                          'Sent': 'bg-blue-50 text-blue-600 border-blue-100',
                          'Paid': 'bg-emerald-50 text-emerald-600 border-emerald-100',
                          'Cancelled': 'bg-rose-50 text-rose-600 border-rose-100',
                        };

                        return (
                          <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer">
                            <td className="px-6 py-5 font-mono font-black text-slate-400 group-hover:text-primary transition-colors">
                              {invoice.invoiceNumber}
                            </td>
                            <td className="px-6 py-5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                                {invoice.type}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black border border-indigo-100 group-hover:scale-110 transition-transform">
                                  {venueName?.[0] || invoice.source[0] || 'N'}
                                </div>
                                <span className="font-black text-slate-900 dark:text-white uppercase tracking-widest">{venueName || invoice.source}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 font-black text-slate-900 dark:text-white">
                              {formatCurrency(invoice.amount)}
                            </td>
                            <td className="px-6 py-5">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[invoice.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {invoice.status}
                              </span>
                            </td>
                            <td className="px-6 py-5 font-bold">
                              {invoice.createdAt ? formatDate(invoice.createdAt) : 'N/A'}
                            </td>
                            <td className="px-6 py-5 text-center">
                              <button
                                onClick={() => generateInvoicePDF(invoice)}
                                className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary hover:border-primary/30 border border-transparent transition-all flex items-center justify-center mx-auto"
                              >
                                <span className="material-symbols-outlined text-lg">download</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ui-card flex flex-col h-fit sticky top-8">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none">Settlement Summary</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Platform Disbursement Tracking</p>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="size-1 rounded-full bg-slate-300"></div>
                  Total Commissions
                </div>
                <p className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(settlement.commissionCollected)}</p>
              </div>

              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="size-1 rounded-full bg-emerald-400"></div>
                  Convenience Fees
                </div>
                <p className="text-xs font-black text-emerald-500">{formatCurrency(metrics.convenienceFees)}</p>
              </div>

              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="size-1 rounded-full bg-rose-400"></div>
                  Processing Fees
                </div>
                <p className="text-xs font-black text-rose-500">-{formatCurrency(settlement.gatewayFees)}</p>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Platform Earnings</p>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(settlement.settledToPlatform)}</p>
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Ready</span>
                </div>
              </div>
            </div>

            {settlementError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20 text-rose-600 text-[10px] font-bold leading-relaxed">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span className="uppercase tracking-widest">Settlement Error</span>
                </div>
                {settlementError}
              </div>
            )}

            <button
              onClick={() => setShowSettlementConfirm(true)}
              disabled={settlementLoading || settlement.settledToPlatform <= 0}
              className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-3 uppercase text-[10px] tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {settlementLoading ? (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              ) : (
                <>
                  Process Settlement
                  <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </>
              )}
            </button>

            <p className="text-center text-[8px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
              By executing, you confirm all source transactions have been verified through transaction records.
            </p>
          </div>
        </div>
      </div>

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoiceModal}
        onClose={() => setShowCreateInvoiceModal(false)}
        onCreate={handleCreateInvoice}
      />

      {/* Settlement Confirmation Modal */}
      {showSettlementConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirm Payout</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium">This process will execute the final disbursement of platform earnings.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 space-y-4 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Total Commissions</span>
                  <span className="text-slate-900 dark:text-white">{formatCurrency(settlement.commissionCollected)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Convenience Fees</span>
                  <span className="text-emerald-500">{formatCurrency(metrics.convenienceFees)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Processing Fees</span>
                  <span className="text-rose-500">-{formatCurrency(settlement.gatewayFees)}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Final Payout Amount</span>
                  <span className="text-xl font-black text-primary">{formatCurrency(settlement.settledToPlatform)}</span>
                </div>
              </div>

              {settlementError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold">
                  {settlementError}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSettlementConfirm(false);
                  setSettlementError(null);
                }}
                disabled={settlementLoading}
                className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Abort
              </button>
              <button
                onClick={handleExecuteSettlement}
                disabled={settlementLoading}
                className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {settlementLoading ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                ) : (
                  'Confirm & Process'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financials;
