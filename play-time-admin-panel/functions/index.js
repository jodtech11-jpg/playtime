/**
 * Cloud Functions for Firebase
 * FCM Push Notification Service
 */

const functions = require('firebase-functions');
const {onDocumentCreated, onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Send push notification to multiple FCM tokens
 * POST /sendNotification
 * 
 * Body:
 * {
 *   notification: {
 *     title: string,
 *     body: string,
 *     imageUrl?: string
 *   },
 *   data: {
 *     type: string,
 *     actionUrl?: string,
 *     actionText?: string,
 *     notificationId: string
 *   },
 *   tokens: string[]
 * }
 */
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { notification, data, tokens } = req.body;

    // Validate required fields
    if (!notification || !notification.title || !notification.body) {
      res.status(400).json({ 
        error: 'Missing required fields: notification.title and notification.body are required' 
      });
      return;
    }

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ 
        error: 'Missing or invalid tokens array. At least one token is required.' 
      });
      return;
    }

    // Prepare the message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      data: {
        type: (data && data.type) || 'general',
        actionUrl: (data && data.actionUrl) || '',
        actionText: (data && data.actionText) || '',
        notificationId: (data && data.notificationId) || '',
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      tokens: tokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Send notifications using Firebase Admin SDK
    const response = await admin.messaging().sendEachForMulticast(message);

    // Return results
    res.json({
      success: response.successCount,
      failed: response.failureCount,
      responses: response.responses.map((resp, idx) => ({
        token: tokens[idx],
        success: resp.success,
        error: resp.error ? resp.error.message : null
      }))
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: (process.env.NODE_ENV === 'development' && error.stack) || undefined
    });
  }
});

/**
 * Send notification to user by userId
 * POST /sendNotificationToUser
 * 
 * Body:
 * {
 *   userId: string,
 *   notification: {
 *     title: string,
 *     body: string,
 *     imageUrl?: string
 *   },
 *   data: {
 *     type: string,
 *     id?: string
 *   }
 * }
 */
exports.sendNotificationToUser = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { userId, notification, data } = req.body;

    if (!userId || !notification || !notification.title || !notification.body) {
      res.status(400).json({ 
        error: 'Missing required fields: userId, notification.title and notification.body are required' 
      });
      return;
    }

    // Get FCM tokens for user
    const tokensSnapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      res.status(404).json({ error: 'No active FCM tokens found for user' });
      return;
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);

    if (tokens.length === 0) {
      res.status(404).json({ error: 'No valid FCM tokens found for user' });
      return;
    }

    // Create notification document in Firestore
    const notificationDoc = await admin.firestore().collection('notifications').add({
      userId: userId,
      title: notification.title,
      body: notification.body,
      type: (data && data.type) || 'general',
      data: data || {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Prepare the message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      data: {
        type: (data && data.type) || 'general',
        id: (data && data.id) || notificationDoc.id,
        notificationId: notificationDoc.id,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      tokens: tokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Send notifications
    const response = await admin.messaging().sendEachForMulticast(message);

    res.json({
      success: response.successCount,
      failed: response.failureCount,
      notificationId: notificationDoc.id,
      tokensSent: tokens.length
    });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Send notification to topic
 * POST /sendNotificationToTopic
 * 
 * Body:
 * {
 *   topic: string,
 *   notification: {
 *     title: string,
 *     body: string,
 *     imageUrl?: string
 *   },
 *   data: {
 *     type: string,
 *     id?: string
 *   }
 * }
 */
exports.sendNotificationToTopic = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { topic, notification, data } = req.body;

    if (!topic || !notification || !notification.title || !notification.body) {
      res.status(400).json({ 
        error: 'Missing required fields: topic, notification.title and notification.body are required' 
      });
      return;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      data: {
        type: (data && data.type) || 'general',
        id: (data && data.id) || '',
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      topic: topic,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);

    res.json({
      success: true,
      messageId: response
    });
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Firestore trigger: Send notification when booking is created
 */
exports.onBookingCreated = onDocumentCreated(
  'bookings/{bookingId}',
  async (event) => {
    try {
      const booking = event.data.data();
      const userId = booking.userId;

      if (!userId) return null;

      // Get FCM tokens for user
      const tokensSnapshot = await admin.firestore()
        .collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens found for user:', userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      // Create notification document
      const notificationDoc = await admin.firestore().collection('notifications').add({
        userId: userId,
        title: 'Booking Confirmed!',
        body: `Your booking at ${booking.venueName || 'venue'} has been confirmed.`,
        type: 'booking',
        data: {
          bookingId: event.params.bookingId,
        },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send FCM notification
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
        tokens: tokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_importance_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log('Notification sent for booking:', event.params.bookingId);
    } catch (error) {
      console.error('Error in onBookingCreated:', error);
    }
    return null;
  }
);

/**
 * Firestore trigger: Send notification when booking status changes
 */
exports.onBookingStatusChanged = onDocumentUpdated(
  'bookings/{bookingId}',
  async (event) => {
    try {
      const before = event.data.before.data();
      const after = event.data.after.data();
      const userId = after.userId;

      if (!userId || before.status === after.status) return null;

      // Get FCM tokens for user
      const tokensSnapshot = await admin.firestore()
        .collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens found for user:', userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      let notificationTitle = '';
      let notificationBody = '';
      let notificationType = 'booking';

      switch (after.status) {
        case 'Confirmed':
          notificationTitle = 'Booking Confirmed!';
          notificationBody = `Your booking at ${after.venueName || 'venue'} has been confirmed.`;
          break;
        case 'Cancelled':
          notificationTitle = 'Booking Cancelled';
          notificationBody = `Your booking at ${after.venueName || 'venue'} has been cancelled.`;
          notificationType = 'booking_cancelled';
          break;
        case 'Completed':
          notificationTitle = 'Booking Completed';
          notificationBody = `Your booking at ${after.venueName || 'venue'} has been completed.`;
          notificationType = 'booking_completed';
          break;
        default:
          return null;
      }

      // Create notification document
      const notificationDoc = await admin.firestore().collection('notifications').add({
        userId: userId,
        title: notificationTitle,
        body: notificationBody,
        type: notificationType,
        data: {
          bookingId: event.params.bookingId,
        },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send FCM notification
      const message = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: notificationType,
          id: event.params.bookingId,
          bookingId: event.params.bookingId,
          notificationId: notificationDoc.id,
        },
        tokens: tokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_importance_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log('Notification sent for booking status change:', event.params.bookingId);
    } catch (error) {
      console.error('Error in onBookingStatusChanged:', error);
    }
    return null;
  }
);

/**
 * Health check endpoint
 * GET /health
 */
exports.health = functions.https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ 
    status: 'ok', 
    service: 'FCM Notification Service',
    timestamp: new Date().toISOString()
  });
});

