/**
 * Export Utilities
 * Provides CSV and PDF export functionality
 */

import jsPDF from 'jspdf';
import { Booking, Membership, Transaction, Invoice, User, Venue } from '../types';
import { formatDate, formatTime, formatDateTime } from './dateUtils';
import { formatCurrency } from './formatUtils';

/**
 * Escape CSV value (handles commas, quotes, newlines)
 */
const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Convert array of objects to CSV string
 */
const arrayToCSV = (data: any[], headers: string[]): string => {
  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...data.map(row => headers.map(header => escapeCSV(row[header])).join(','))
  ];
  return csvRows.join('\n');
};

/**
 * Download file
 */
const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ==================== CSV EXPORTS ====================

/**
 * Export bookings to CSV
 */
export const exportBookingsToCSV = (bookings: Booking[], venues: Venue[] = []): void => {
  const venueMap = new Map(venues.map(v => [v.id, v.name]));

  const data = bookings.map(booking => ({
    'Booking ID': booking.id,
    'Venue': venueMap.get(booking.venueId) || booking.venueId,
    'Court': booking.court || booking.courtId,
    'Sport': booking.sport,
    'User': booking.user,
    'Date': booking.startTime
      ? formatDate(booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime))
      : formatDate(booking.date),
    'Time': booking.startTime
      ? formatTime(booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime))
      : booking.time,
    'Duration (hours)': booking.duration || 0,
    'Status': booking.status,
    'Amount': booking.amount || 0,
    'Payment Status': booking.paymentStatus || 'Pending',
    'Payment Method': booking.paymentMethod || 'N/A',
  }));

  const headers = Object.keys(data[0] || {});
  const csv = arrayToCSV(data, headers);
  const filename = `bookings-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

/**
 * Export memberships to CSV
 */
export const exportMembershipsToCSV = (
  memberships: Membership[],
  users: User[] = [],
  venues: Venue[] = []
): void => {
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const venueMap = new Map(venues.map(v => [v.id, v.name]));

  const data = memberships.map(membership => ({
    'Membership ID': membership.id,
    'User': userMap.get(membership.userId) || membership.userId,
    'Venue': venueMap.get(membership.venueId) || membership.venueId,
    'Plan Name': membership.planName,
    'Plan Type': membership.planType,
    'Price': membership.price,
    'Start Date': formatDate(membership.startDate),
    'End Date': formatDate(membership.endDate),
    'Status': membership.status,
    'Payment Status': membership.paymentStatus || 'Pending',
    'Payment Method': membership.paymentMethod || 'N/A',
  }));

  const headers = Object.keys(data[0] || {});
  const csv = arrayToCSV(data, headers);
  const filename = `memberships-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

/**
 * Export transactions to CSV
 */
export const exportTransactionsToCSV = (transactions: Transaction[]): void => {
  const data = transactions.map(transaction => ({
    'Transaction ID': transaction.id,
    'Type': transaction.type,
    'Source': transaction.source,
    'Amount': transaction.amount,
    'Platform Commission': transaction.platformCommission || 0,
    'Convenience Fee': transaction.convenienceFee || 0,
    'Venue Payout': transaction.venuePayout || 0,
    'Net Platform': transaction.netPlatform || 0,
    'Status': transaction.status,
    'Date': transaction.createdAt
      ? formatDate(transaction.createdAt.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt))
      : 'N/A',
  }));

  const headers = Object.keys(data[0] || {});
  const csv = arrayToCSV(data, headers);
  const filename = `transactions-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

/**
 * Export users to CSV
 */
export const exportUsersToCSV = (users: User[]): void => {
  const data = users.map(user => ({
    'User ID': user.id,
    'Name': user.name,
    'Email': user.email,
    'Phone': user.phone || 'N/A',
    'Role': user.role,
    'Status': user.status,
    'Created At': user.createdAt
      ? formatDate(user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt))
      : 'N/A',
  }));

  const headers = Object.keys(data[0] || {});
  const csv = arrayToCSV(data, headers);
  const filename = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

// ==================== PDF EXPORTS ====================

/**
 * Export bookings to PDF
 */
export const exportBookingsToPDF = (
  bookings: Booking[],
  title: string = 'Bookings Report',
  venues: Venue[] = []
): void => {
  const doc = new jsPDF();
  const venueMap = new Map(venues.map(v => [v.id, v.name]));

  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;
  const maxY = pageHeight - margin;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, yPos);
  yPos += 10;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${formatDateTime(new Date())}`, margin, yPos);
  yPos += 10;

  // Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Bookings: ${bookings.length}`, margin, yPos);
  yPos += 8;

  const totalRevenue = bookings
    .filter(b => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
    .reduce((sum, b) => sum + (b.amount || 0), 0);
  doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, margin, yPos);
  yPos += 12;

  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['Date', 'Venue', 'Court', 'User', 'Amount', 'Status'];
  const colWidths = [30, 40, 25, 40, 25, 25];
  let xPos = margin;

  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[i];
  });
  yPos += lineHeight;

  // Table rows
  doc.setFont('helvetica', 'normal');
  bookings.forEach((booking, index) => {
    // Check if we need a new page
    if (yPos > maxY - lineHeight) {
      doc.addPage();
      yPos = margin;

      // Redraw headers
      doc.setFont('helvetica', 'bold');
      xPos = margin;
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += lineHeight;
      doc.setFont('helvetica', 'normal');
    }

    const date = booking.startTime
      ? formatDate(booking.startTime.toDate ? booking.startTime.toDate() : new Date(booking.startTime))
      : formatDate(booking.date);
    const venue = venueMap.get(booking.venueId) || booking.venueId;
    const court = booking.court || booking.courtId;
    const user = booking.user || 'N/A';
    const amount = formatCurrency(booking.amount || 0);
    const status = booking.status;

    xPos = margin;
    const rowData = [date, venue, court, user, amount, status];
    rowData.forEach((cell, i) => {
      doc.text(cell.substring(0, 20), xPos, yPos); // Truncate long text
      xPos += colWidths[i];
    });
    yPos += lineHeight;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`bookings-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export financial report to PDF
 */
export const exportFinancialReportToPDF = (
  transactions: Transaction[],
  metrics: {
    grossBookingValue: number;
    platformCommission: number;
    convenienceFees: number;
    pendingVenuePayouts: number;
  },
  title: string = 'Revenue Analysis Report'
): void => {
  const doc = new jsPDF();
  let yPos = 20;
  const margin = 20;
  const lineHeight = 7;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, yPos);
  yPos += 10;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${formatDateTime(new Date())}`, margin, yPos);
  yPos += 15;

  // Summary Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gross Booking Value: ${formatCurrency(metrics.grossBookingValue)}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Platform Commission: ${formatCurrency(metrics.platformCommission)}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Convenience Fees: ${formatCurrency(metrics.convenienceFees)}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Pending Venue Payouts: ${formatCurrency(metrics.pendingVenuePayouts)}`, margin, yPos);
  yPos += 15;

  // Transactions Table
  if (transactions.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Transactions', margin, yPos);
    yPos += 10;

    // Table headers
    doc.setFontSize(9);
    const headers = ['Date', 'Type', 'Source', 'Amount', 'Status'];
    const colWidths = [35, 30, 50, 35, 30];
    let xPos = margin;

    headers.forEach((header, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    yPos += lineHeight;

    // Table rows
    doc.setFont('helvetica', 'normal');
    transactions.slice(0, 50).forEach((transaction) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = margin;
      }

      const date = transaction.createdAt
        ? formatDate(transaction.createdAt.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt))
        : 'N/A';
      const type = transaction.type;
      const source = transaction.source.substring(0, 20);
      const amount = formatCurrency(transaction.amount);
      const status = transaction.status;

      xPos = margin;
      [date, type, source, amount, status].forEach((cell, i) => {
        doc.text(cell, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += lineHeight;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`financial-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Export members list to PDF
 */
export const exportMembersToPDF = (
  memberships: Membership[],
  users: User[] = [],
  venues: Venue[] = [],
  title: string = 'Members Report'
): void => {
  const doc = new jsPDF();
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const venueMap = new Map(venues.map(v => [v.id, v.name]));

  let yPos = 20;
  const margin = 20;
  const lineHeight = 7;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${formatDateTime(new Date())}`, margin, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Members: ${memberships.length}`, margin, yPos);
  yPos += 12;

  // Table headers
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['User', 'Venue', 'Plan', 'Status', 'Start Date', 'End Date'];
  const colWidths = [40, 40, 35, 25, 25, 25];
  let xPos = margin;

  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[i];
  });
  yPos += lineHeight;

  // Table rows
  doc.setFont('helvetica', 'normal');
  memberships.forEach((membership) => {
    if (yPos > 280) {
      doc.addPage();
      yPos = margin;
      // Redraw headers
      doc.setFont('helvetica', 'bold');
      xPos = margin;
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += lineHeight;
      doc.setFont('helvetica', 'normal');
    }

    const user = userMap.get(membership.userId) || 'N/A';
    const venue = venueMap.get(membership.venueId) || 'N/A';
    const plan = membership.planName;
    const status = membership.status;
    const startDate = formatDate(membership.startDate);
    const endDate = formatDate(membership.endDate);

    xPos = margin;
    [user, venue, plan, status, startDate, endDate].forEach((cell, i) => {
      doc.text(cell.substring(0, 15), xPos, yPos);
      xPos += colWidths[i];
    });
    yPos += lineHeight;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`members-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Generate PDF invoice
 */
export const generateInvoicePDF = (invoice: Invoice, venueName?: string): void => {
  const doc = new jsPDF();
  let yPos = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - margin - 30, yPos, { align: 'right' });
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - margin - 30, yPos, { align: 'right' });
  yPos += 8;
  doc.text(`Date: ${formatDate(invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date())}`, pageWidth - margin - 30, yPos, { align: 'right' });
  yPos += 8;
  if (invoice.dueDate) {
    doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, pageWidth - margin - 30, yPos, { align: 'right' });
    yPos += 8;
  }

  yPos = 50;

  // Company Info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Play Time', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sports Facility Management Platform', margin, yPos);
  yPos += 15;

  // Bill To
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(venueName || invoice.source, margin, yPos);
  yPos += 20;

  // Invoice Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details', margin, yPos);
  yPos += 10;

  // Breakdown Table
  doc.setFontSize(10);
  const breakdown = invoice.breakdown;

  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin, yPos);
  doc.text('Amount', pageWidth - margin - 40, yPos, { align: 'right' });
  yPos += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.text('Gross Amount', margin, yPos);
  doc.text(formatCurrency(breakdown.gross), pageWidth - margin - 40, yPos, { align: 'right' });
  yPos += 8;

  if (breakdown.commission) {
    doc.text('Platform Commission (5%)', margin, yPos);
    doc.text(formatCurrency(breakdown.commission), pageWidth - margin - 40, yPos, { align: 'right' });
    yPos += 8;
  }

  if (breakdown.convenienceFee) {
    doc.text('Convenience Fee', margin, yPos);
    doc.text(formatCurrency(breakdown.convenienceFee), pageWidth - margin - 40, yPos, { align: 'right' });
    yPos += 8;
  }

  if (breakdown.gatewayFee) {
    doc.text('Processing Fee', margin, yPos);
    doc.text(formatCurrency(breakdown.gatewayFee), pageWidth - margin - 40, yPos, { align: 'right' });
    yPos += 8;
  }

  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Amount', margin, yPos);
  doc.text(formatCurrency(breakdown.net), pageWidth - margin - 40, yPos, { align: 'right' });
  yPos += 15;

  // Status
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Status: ${invoice.status}`, margin, yPos);
  yPos += 8;

  if (invoice.paymentMethod) {
    doc.text(`Payment Method: ${invoice.paymentMethod}`, margin, yPos);
    yPos += 8;
  }

  if (invoice.paymentReference) {
    doc.text(`Payment Reference: ${invoice.paymentReference}`, margin, yPos);
  }

  // Footer
  yPos = doc.internal.pageSize.height - 30;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Thank you for your business!',
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
};

