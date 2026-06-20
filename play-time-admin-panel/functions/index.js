/**
 * Cloud Functions for Firebase
 * FCM Push Notification Service + Razorpay webhooks
 *
 * Security:
 * - All outbound notification endpoints (sendNotification*) require a Firebase ID
 *   token in `Authorization: Bearer <idToken>` and the caller must have role
 *   `super_admin` or `venue_manager` in the `users` collection.
 * - Razorpay webhook verifies an HMAC signature using the configured secret.
 */

const functions = require('firebase-functions');
const {onDocumentCreated, onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Allow-list of origins for admin-panel requests (env ALLOWED_ORIGINS = comma list). */
function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

/** Set CORS headers. Echoes the request Origin when it is in the allow-list. */
function applyCors(req, res) {
  const allowed = getAllowedOrigins();
  const origin = req.get('origin') || '';
  if (allowed.length === 0) {
    res.set('Access-Control-Allow-Origin', origin || '*');
  } else if (allowed.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * Verify Firebase ID token in the `Authorization: Bearer <token>` header and
 * check the caller has an admin role. Returns decoded token + user doc, or
 * sends an HTTP error and returns null.
 */
async function requireAdmin(req, res) {
  const authHeader = req.get('authorization') || req.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({error: 'Missing or invalid Authorization header'});
    return null;
  }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (err) {
    console.warn('verifyIdToken failed:', err.message);
    res.status(401).json({error: 'Invalid ID token'});
    return null;
  }
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(decoded.uid)
    .get();
  if (!userDoc.exists) {
    res.status(403).json({error: 'User record not found'});
    return null;
  }
  const role = userDoc.data().role;
  if (role !== 'super_admin' && role !== 'venue_manager') {
    res.status(403).json({error: 'Insufficient privileges'});
    return null;
  }
  return {uid: decoded.uid, role, userData: userDoc.data()};
}

// ---------------------------------------------------------------------------
// FCM HTTPS endpoints (admin-only)
// ---------------------------------------------------------------------------

/**
 * Send push notification to multiple FCM tokens.
 * Requires `Authorization: Bearer <idToken>` (super_admin or venue_manager).
 * POST body: { notification: {title, body, imageUrl?}, data: {...}, tokens: string[] }
 */
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const {notification, data, tokens} = req.body;
    if (!notification || !notification.title || !notification.body) {
      res.status(400).json({error: 'Missing required fields: notification.title and notification.body'});
      return;
    }
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({error: 'Missing or invalid tokens array'});
      return;
    }
    if (tokens.length > 500) {
      res.status(400).json({error: 'Too many tokens (max 500 per call)'});
      return;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: (data && data.type) || 'general',
        actionUrl: (data && data.actionUrl) || '',
        actionText: (data && data.actionText) || '',
        notificationId: (data && data.notificationId) || '',
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      tokens,
      android: {
        priority: 'high',
        notification: {sound: 'default', channelId: 'default'},
      },
      apns: {
        payload: {aps: {sound: 'default', badge: 1}},
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Do NOT echo tokens back; use index-based references only.
    res.json({
      success: response.successCount,
      failed: response.failureCount,
      responses: response.responses.map((resp, idx) => ({
        index: idx,
        success: resp.success,
        error: resp.error ? resp.error.message : null,
      })),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({error: error.message || 'Internal server error'});
  }
});

/**
 * Send notification to a user by userId (looks up their active fcmTokens).
 * Requires `Authorization: Bearer <idToken>` (super_admin or venue_manager).
 */
exports.sendNotificationToUser = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const {userId, notification, data} = req.body;
    if (!userId || !notification || !notification.title || !notification.body) {
      res.status(400).json({error: 'Missing required fields: userId, notification.title, notification.body'});
      return;
    }

    const tokensSnapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      res.status(404).json({error: 'No active FCM tokens found for user'});
      return;
    }

    const tokens = tokensSnapshot.docs.map((doc) => doc.data().token).filter(Boolean);
    if (tokens.length === 0) {
      res.status(404).json({error: 'No valid FCM tokens found for user'});
      return;
    }

    const notificationDoc = await admin.firestore().collection('notifications').add({
      userId,
      title: notification.title,
      body: notification.body,
      type: (data && data.type) || 'general',
      data: data || {},
      read: false,
      createdBy: auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: (data && data.type) || 'general',
        id: (data && data.id) || notificationDoc.id,
        notificationId: notificationDoc.id,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      tokens,
      android: {
        priority: 'high',
        notification: {sound: 'default', channelId: 'high_importance_channel'},
      },
      apns: {
        payload: {aps: {sound: 'default', badge: 1}},
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    res.json({
      success: response.successCount,
      failed: response.failureCount,
      notificationId: notificationDoc.id,
      tokensSent: tokens.length,
    });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({error: error.message || 'Internal server error'});
  }
});

/**
 * Send notification to an FCM topic.
 * Requires `Authorization: Bearer <idToken>` (super_admin or venue_manager).
 */
exports.sendNotificationToTopic = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const {topic, notification, data} = req.body;
    if (!topic || !notification || !notification.title || !notification.body) {
      res.status(400).json({error: 'Missing required fields: topic, notification.title, notification.body'});
      return;
    }
    // Validate topic format per FCM rules ([a-zA-Z0-9-_.~%]+)
    if (!/^[a-zA-Z0-9\-_.~%]+$/.test(topic)) {
      res.status(400).json({error: 'Invalid topic name'});
      return;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: (data && data.type) || 'general',
        id: (data && data.id) || '',
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      topic,
      android: {
        priority: 'high',
        notification: {sound: 'default', channelId: 'high_importance_channel'},
      },
      apns: {
        payload: {aps: {sound: 'default', badge: 1}},
      },
    };

    const response = await admin.messaging().send(message);
    res.json({success: true, messageId: response});
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    res.status(500).json({error: error.message || 'Internal server error'});
  }
});

// ---------------------------------------------------------------------------
// Firestore triggers
// ---------------------------------------------------------------------------

/** Send notification when a booking is created. */
exports.onBookingCreated = onDocumentCreated(
  'bookings/{bookingId}',
  async (event) => {
    try {
      const booking = event.data.data();
      const userId = booking.userId;
      if (!userId) return null;

      const tokensSnapshot = await admin.firestore()
        .collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens for user:', userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      const notificationDoc = await admin.firestore().collection('notifications').add({
        userId,
        title: 'Booking Confirmed!',
        body: `Your booking at ${booking.venueName || 'venue'} has been confirmed.`,
        type: 'booking',
        data: {bookingId: event.params.bookingId},
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const message = {
        notification: {
          title: 'Booking Confirmed!',
          body: `Your booking at ${booking.venueName || 'venue'} has been confirmed.`,
        },
        data: {
          type: 'booking',
          id: event.params.bookingId,
          bookingId: event.params.bookingId,
          notificationId: notificationDoc.id,
        },
        tokens,
        android: {priority: 'high', notification: {sound: 'default', channelId: 'high_importance_channel'}},
        apns: {payload: {aps: {sound: 'default', badge: 1}}},
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log('Notification sent for booking:', event.params.bookingId);
    } catch (error) {
      console.error('Error in onBookingCreated:', error);
      // Allow default Cloud Functions retry semantics for transient errors by rethrowing.
      throw error;
    }
    return null;
  },
);

/** Send notification when a booking's status changes. */
exports.onBookingStatusChanged = onDocumentUpdated(
  'bookings/{bookingId}',
  async (event) => {
    try {
      const before = event.data.before.data();
      const after = event.data.after.data();
      const userId = after.userId;
      if (!userId || before.status === after.status) return null;

      const tokensSnapshot = await admin.firestore()
        .collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens for user:', userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      let title = '';
      let body = '';
      let type = 'booking';
      switch (after.status) {
        case 'Confirmed':
          title = 'Booking Confirmed!';
          body = `Your booking at ${after.venueName || 'venue'} has been confirmed.`;
          break;
        case 'Cancelled':
          title = 'Booking Cancelled';
          body = `Your booking at ${after.venueName || 'venue'} has been cancelled.`;
          type = 'booking_cancelled';
          break;
        case 'Completed':
          title = 'Booking Completed';
          body = `Your booking at ${after.venueName || 'venue'} has been completed.`;
          type = 'booking_completed';
          break;
        default:
          return null;
      }

      const notificationDoc = await admin.firestore().collection('notifications').add({
        userId,
        title,
        body,
        type,
        data: {bookingId: event.params.bookingId},
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const message = {
        notification: {title, body},
        data: {
          type,
          id: event.params.bookingId,
          bookingId: event.params.bookingId,
          notificationId: notificationDoc.id,
        },
        tokens,
        android: {priority: 'high', notification: {sound: 'default', channelId: 'high_importance_channel'}},
        apns: {payload: {aps: {sound: 'default', badge: 1}}},
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log('Notification sent for booking status change:', event.params.bookingId);
    } catch (error) {
      console.error('Error in onBookingStatusChanged:', error);
      throw error;
    }
    return null;
  },
);

// ---------------------------------------------------------------------------
// Razorpay webhooks
// ---------------------------------------------------------------------------

/**
 * Razorpay webhooks — verifies HMAC-SHA256 of the raw body using the configured secret.
 * Set with: `firebase functions:config:set razorpay.webhook_secret="<secret>"`
 * or env `RAZORPAY_WEBHOOK_SECRET`.
 * Register this URL in Razorpay Dashboard → Webhooks.
 */
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  // Webhooks do not use CORS; respond minimally and do not echo origins.
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ||
    (functions.config().razorpay && functions.config().razorpay.webhook_secret);
  if (!secret) {
    console.warn('razorpay webhook_secret not set (env RAZORPAY_WEBHOOK_SECRET or functions config)');
    res.status(503).json({error: 'Webhook secret not configured'});
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sig = req.get('x-razorpay-signature') || '';

  // Constant-time comparison to avoid signature timing attacks.
  let signatureOk = false;
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig, 'hex');
    signatureOk = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    signatureOk = false;
  }
  if (!signatureOk) {
    res.status(400).json({error: 'Invalid signature'});
    return;
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      res.status(400).json({error: 'Invalid JSON'});
      return;
    }
  }

  const event = payload && payload.event;
  const now = admin.firestore.FieldValue.serverTimestamp();
  try {
    const entity = payload && payload.payload &&
      payload.payload.payment &&
      payload.payload.payment.entity;
    const bookingId = entity && entity.notes && entity.notes.bookingId;
    const membershipId = entity && entity.notes && entity.notes.membershipId;
    const paymentId = entity && entity.id;
    const amountPaise = (entity && entity.amount) || 0;
    const amountRefundedPaise = (entity && entity.amount_refunded) || 0;

    if (event === 'payment.captured' || event === 'order.paid') {
      if (bookingId && paymentId) {
        await admin.firestore().collection('bookings').doc(bookingId).set({
          paymentStatus: 'Paid',
          paymentTransactionId: paymentId,
          webhookVerifiedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      if (membershipId && paymentId) {
        await admin.firestore().collection('memberships').doc(membershipId).set({
          paymentStatus: 'Paid',
          paymentTransactionId: paymentId,
          webhookVerifiedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      // Record the payment (idempotent using paymentId as doc id).
      if (paymentId) {
        await admin.firestore().collection('payments').doc(paymentId).set({
          paymentId,
          bookingId: bookingId || null,
          membershipId: membershipId || null,
          amount: amountPaise / 100,
          currency: (entity && entity.currency) || 'INR',
          provider: 'Razorpay',
          status: 'Paid',
          rawEvent: event,
          createdAt: now,
          updatedAt: now,
        }, {merge: true});
      }
    } else if (event === 'payment.failed') {
      if (bookingId) {
        await admin.firestore().collection('bookings').doc(bookingId).set({
          paymentStatus: 'Pending',
          updatedAt: now,
        }, {merge: true});
      }
      if (membershipId) {
        await admin.firestore().collection('memberships').doc(membershipId).set({
          paymentStatus: 'Pending',
          updatedAt: now,
        }, {merge: true});
      }
    } else if (event === 'refund.created' || event === 'refund.processed') {
      if (bookingId) {
        await admin.firestore().collection('bookings').doc(bookingId).set({
          paymentStatus: 'Refunded',
          updatedAt: now,
        }, {merge: true});
      }
      if (membershipId) {
        await admin.firestore().collection('memberships').doc(membershipId).set({
          paymentStatus: 'Refunded',
          updatedAt: now,
        }, {merge: true});
      }
      if (paymentId) {
        await admin.firestore().collection('payments').doc(paymentId).set({
          paymentId,
          bookingId: bookingId || null,
          membershipId: membershipId || null,
          amountRefunded: amountRefundedPaise / 100,
          status: 'Refunded',
          rawEvent: event,
          updatedAt: now,
        }, {merge: true});
      }
    }
  } catch (err) {
    console.error('razorpayWebhook handler error:', err);
    res.status(500).json({error: err.message || 'Handler error'});
    return;
  }

  res.json({received: true});
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Health check endpoint — GET /health */
exports.health = functions.https.onRequest((req, res) => {
  applyCors(req, res);
  res.json({
    status: 'ok',
    service: 'FCM Notification Service',
    timestamp: new Date().toISOString(),
  });
});
