/**
 * Razorpay webhook handler — SERVER-SIDE ONLY.
 *
 * The real webhook lives in `functions/index.js` (`razorpayWebhook` Cloud Function).
 * That function verifies the HMAC-SHA256 signature against
 * `RAZORPAY_WEBHOOK_SECRET` (or `functions.config().razorpay.webhook_secret`)
 * and updates `bookings`, `memberships`, and `payments` via the Admin SDK.
 *
 * This file used to contain a browser reference implementation whose
 * `verifyWebhookSignature` always returned `true` — that was a footgun and has
 * been removed. Do not re-introduce webhook verification in the browser.
 *
 * To register the webhook:
 * 1. Deploy: `firebase deploy --only functions:razorpayWebhook`
 * 2. Copy the function URL from the Firebase console.
 * 3. Razorpay Dashboard → Webhooks → Add, paste URL, configure secret matching
 *    `RAZORPAY_WEBHOOK_SECRET`.
 * 4. Subscribe to at least: payment.captured, payment.failed, order.paid,
 *    refund.created, refund.processed.
 */

export {};
