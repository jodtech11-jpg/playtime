/**
 * Razorpay Payment Service
 * Handles Razorpay payment gateway integration
 * Venues store only razorpay.enabled; API key comes from platform settings (appSettings/integrations/razorpay).
 */

import { Booking, Membership, Venue, AppSettings } from '../types';
import { getDocument } from './firebase';

// Razorpay types
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

/**
 * Load Razorpay script dynamically
 */
export const loadRazorpayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Razorpay) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="razorpay"]');
    if (existingScript) {
      // Use { once: true } to prevent stacking duplicate listeners on concurrent calls
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay script')), { once: true });
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay payment for booking
 */
export const initiateBookingPayment = async (
  booking: Booking,
  venue: Venue,
  userDetails: { name?: string; email?: string; phone?: string },
  onSuccess: (paymentId: string, orderId?: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  try {
    // Load Razorpay script
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not loaded');
    }

    // Get Razorpay key (venue or platform-level credentials)
    const razorpayKey = await getRazorpayKeyForVenue(venue);
    if (!razorpayKey) {
      throw new Error('Razorpay not configured for this venue');
    }

    // Calculate amount in paise (Razorpay uses smallest currency unit)
    const amountInPaise = Math.round((booking.amount || 0) * 100);

    // Create Razorpay options
    const options: RazorpayOptions = {
      key: razorpayKey,
      amount: amountInPaise,
      currency: 'INR',
      name: 'Play Time',
      description: `Booking payment for ${venue.name}`,
      prefill: {
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.phone,
      },
      notes: {
        bookingId: booking.id,
        venueId: venue.id,
        userId: booking.userId,
      },
      handler: (response: RazorpayResponse) => {
        // Payment successful
        onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
      },
      modal: {
        ondismiss: () => {
          onError('Payment cancelled by user');
        },
      },
    };

    // Create Razorpay instance and open checkout
    const razorpay = new window.Razorpay(options);
    razorpay.on('payment.failed', (response: any) => {
      onError(response.error.description || 'Payment failed');
    });
    razorpay.open();
  } catch (error: any) {
    console.error('Error initiating Razorpay payment:', error);
    onError(error.message || 'Failed to initiate payment');
  }
};

/**
 * Initialize Razorpay payment for membership
 */
export const initiateMembershipPayment = async (
  membership: Membership,
  venue: Venue,
  userDetails: { name?: string; email?: string; phone?: string },
  onSuccess: (paymentId: string, orderId?: string) => void,
  onError: (error: string) => void
): Promise<void> => {
  try {
    // Load Razorpay script
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not loaded');
    }

    // Get Razorpay key (venue or platform-level credentials)
    const razorpayKey = await getRazorpayKeyForVenue(venue);
    if (!razorpayKey) {
      throw new Error('Razorpay not configured for this venue');
    }

    // Calculate amount in paise
    const amountInPaise = Math.round(membership.price * 100);

    // Create Razorpay options
    const options: RazorpayOptions = {
      key: razorpayKey,
      amount: amountInPaise,
      currency: 'INR',
      name: 'Play Time',
      description: `Membership payment for ${venue.name} - ${membership.planName}`,
      prefill: {
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.phone,
      },
      notes: {
        membershipId: membership.id,
        venueId: venue.id,
        userId: membership.userId,
        planId: membership.planId,
      },
      handler: (response: RazorpayResponse) => {
        // Payment successful
        onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
      },
      modal: {
        ondismiss: () => {
          onError('Payment cancelled by user');
        },
      },
    };

    // Create Razorpay instance and open checkout
    const razorpay = new window.Razorpay(options);
    razorpay.on('payment.failed', (response: any) => {
      onError(response.error.description || 'Payment failed');
    });
    razorpay.open();
  } catch (error: any) {
    console.error('Error initiating Razorpay payment:', error);
    onError(error.message || 'Failed to initiate payment');
  }
};

/**
 * Verify Razorpay payment signature.
 *
 * IMPORTANT: This function must NEVER be called on the client side.
 * The Razorpay secret key must remain on the backend (Cloud Function / server).
 * Client-side verification exposes the secret key and can be trivially bypassed.
 *
 * Correct flow:
 *  1. Client receives razorpay_payment_id + razorpay_order_id from Razorpay checkout
 *  2. Client sends both IDs to your backend endpoint
 *  3. Backend computes HMAC-SHA256(order_id + "|" + payment_id, razorpay_secret)
 *  4. Backend compares against razorpay_signature and only then updates Firestore
 */
export const verifyPaymentSignature = (
  _orderId: string,
  _paymentId: string,
  _signature: string,
  _secret: string
): never => {
  throw new Error(
    'verifyPaymentSignature must not be called on the client. ' +
    'Verify Razorpay signatures on your backend using HMAC-SHA256.'
  );
};

/**
 * Get Razorpay key for a venue (async).
 * Uses venue's apiKey if present, otherwise platform-level credentials from appSettings.
 */
export const getRazorpayKeyForVenue = async (venue: Venue): Promise<string | null> => {
  if (!venue.paymentSettings?.razorpay?.enabled) {
    return null;
  }
  // Venue may have its own apiKey (legacy) or use platform key
  const venueKey = venue.paymentSettings?.razorpay?.apiKey;
  if (venueKey && venueKey.trim()) {
    return venueKey;
  }
  // Use platform-level Razorpay credentials (system-wide master credentials)
  const settings = await getDocument<AppSettings>('appSettings', 'platform');
  const platformKey = settings?.integrations?.razorpay?.apiKey;
  return (platformKey && platformKey.trim()) ? platformKey : null;
};

/** @deprecated Use getRazorpayKeyForVenue for async key resolution */
export const getRazorpayKey = (venue: Venue): string | null => {
  return venue.paymentSettings?.razorpay?.apiKey || null;
};

/**
 * Check if Razorpay is enabled for venue.
 * Venue must have enabled=true; key resolution happens at payment initiation.
 */
export const isRazorpayEnabled = (venue: Venue): boolean => {
  return venue.paymentSettings?.razorpay?.enabled === true;
};

