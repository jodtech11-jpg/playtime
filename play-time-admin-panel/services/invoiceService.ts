/**
 * Invoice Service
 * Handles invoice PDF generation and management
 */

import { generateInvoicePDF } from '../utils/exportUtils';
import { Invoice } from '../types';
import { useVenues } from '../hooks/useVenues';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

/**
 * Generate invoice PDF — downloads by default, or opens a preview tab when preview=true
 */
export const generateInvoicePDFFile = async (
  invoice: Invoice,
  venueName?: string,
  options?: { preview?: boolean }
): Promise<void> => {
  try {
    generateInvoicePDF(invoice, venueName, options);
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF: ' + getFirebaseErrorMessage(error));
  }
};

/**
 * Get venue name for invoice
 */
export const getInvoiceVenueName = (invoice: Invoice, venues: any[]): string | undefined => {
  const venueId = invoice.venueId || (invoice.type === 'Commission' || invoice.type === 'Settlement' ? invoice.sourceId : undefined);
  const venue = venueId ? venues.find(v => v.id === venueId) : undefined;
  return venue?.name || invoice.source;
};

