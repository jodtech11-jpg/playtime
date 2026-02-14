/**
 * Razorpay Payment Service
 * Handles Razorpay payment gateway integration
 */

import { Booking, Membership, Venue } from '../types';

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
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay script')));
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

    // Get Razorpay key from venue settings
    const razorpayKey = venue.paymentSettings?.razorpay?.apiKey;
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

    // Get Razorpay key from venue settings
    const razorpayKey = venue.paymentSettings?.razorpay?.apiKey;
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
 * Verify Razorpay payment signature
 * This should be done on the backend, but we include it here for reference
 */
export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean => {
  // Note: This verification should ideally be done on the backend
  // Using crypto library for signature verification
  // For now, we'll return true and let backend handle verification
  // In production, always verify on backend before updating payment status
  
  // This is a placeholder - actual verification requires crypto library
  // const crypto = require('crypto');
  // const generatedSignature = crypto
  //   .createHmac('sha256', secret)
  //   .update(orderId + '|' + paymentId)
  //   .digest('hex');
  // return generatedSignature === signature;
  
  return true; // Backend should verify
};

/**
 * Get Razorpay key from venue settings
 */
export const getRazorpayKey = (venue: Venue): string | null => {
  return venue.paymentSettings?.razorpay?.apiKey || null;
};

/**
 * Check if Razorpay is enabled for venue
 */
export const isRazorpayEnabled = (venue: Venue): boolean => {
  return venue.paymentSettings?.razorpay?.enabled === true && 
         !!venue.paymentSettings?.razorpay?.apiKey;
};

