/**
 * Invoice Service
 * Handles invoice PDF generation and management
 */

import { generateInvoicePDF } from '../utils/exportUtils';
import { Invoice } from '../types';
import { useVenues } from '../hooks/useVenues';

/**
 * Generate and download invoice PDF
 */
export const generateInvoicePDFFile = async (
  invoice: Invoice,
  venueName?: string
): Promise<void> => {
  try {
    generateInvoicePDF(invoice, venueName);
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF: ' + error.message);
  }
};

/**
 * Get venue name for invoice
 */
export const getInvoiceVenueName = (invoice: Invoice, venues: any[]): string | undefined => {
  const venue = venues.find(v => v.id === invoice.sourceId);
  return venue?.name || invoice.source;
};

