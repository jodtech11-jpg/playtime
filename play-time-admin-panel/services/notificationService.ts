import { fcmTokensCollection, usersCollection, bookingsCollection, appSettingsCollection, notificationsCollection, auth } from './firebase';
import { FCMToken, Notification, AppSettings } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { sendTrustedWhatsAppMessage } from './trustedAdminApi';

/**
 * Send push notification via the authenticated Cloud Function endpoint.
 *
 * Requirements:
 * - `VITE_FCM_CLOUD_FUNCTION_URL` must point to the deployed `sendNotification`
 *   HTTPS Cloud Function (see `functions/index.js`).
 * - The caller must be signed-in as a super_admin or venue_manager; we attach
 *   their Firebase ID token as a `Authorization: Bearer …` header.
 *
 * The legacy FCM HTTP API (with a server key in the browser) is **not**
 * supported anymore — it leaks the server key and is not safe in production.
 */
export const sendPushNotification = async (
  notification: Notification,
  fcmTokens: string[]
): Promise<{ success: number; failed: number }> => {
  if (fcmTokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  const projectId = auth.app.options.projectId;
  const cloudFunctionUrl =
    import.meta.env.VITE_FCM_CLOUD_FUNCTION_URL ||
    (projectId
      ? `https://us-central1-${projectId}.cloudfunctions.net/sendNotification`
      : '');
  if (!cloudFunctionUrl) return { success: 0, failed: fcmTokens.length };

  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('sendPushNotification: not signed in; cannot obtain ID token.');
    return { success: 0, failed: fcmTokens.length };
  }
  const idToken = await currentUser.getIdToken();

  try {
    let success = 0;
    let failed = 0;
    for (let index = 0; index < fcmTokens.length; index += 500) {
      const tokens = fcmTokens.slice(index, index + 500);
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          notification: {
            title: notification.title,
            body: notification.body,
            imageUrl: notification.imageUrl,
          },
          data: {
            type: notification.type,
            actionUrl: notification.actionUrl || '',
            actionText: notification.actionText || '',
            notificationId: notification.id,
          },
          tokens,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(
          `Cloud Function returned ${response.status}: ${errBody.slice(0, 500)}`
        );
      }
      const result = await response.json();
      success += result.success || 0;
      failed += result.failed ?? tokens.length;
    }
    return { success, failed };
  } catch (error: any) {
    console.error('Error sending notification via Cloud Function:', error);
    throw error;
  }
};

/**
 * Get FCM tokens for target audience
 */
export const getTargetFCMTokens = async (
  targetAudience: Notification['targetAudience'],
  targetUserIds?: string[],
  targetVenueId?: string
): Promise<string[]> => {
  const tokens: string[] = [];

  try {
    const userIds = await getTargetUserIds(
      targetAudience,
      targetUserIds,
      targetVenueId
    );

    if (targetAudience === 'All Users') {
      try {
        const allTokens = await fcmTokensCollection.getAll();
        const validTokens = allTokens
          .filter((tokenData: any) => tokenData.isActive !== false && typeof tokenData.token === 'string' && tokenData.token.trim().length > 0)
          .map((tokenData: any) => tokenData.token.trim());
        tokens.push(...validTokens);
      } catch (e) {
        console.warn('Error querying all FCM tokens:', e);
      }
    } else if (userIds.length > 0) {
      for (let index = 0; index < userIds.length; index += 30) {
        const batchIds = userIds.slice(index, index + 30);
        try {
          const userTokens = await fcmTokensCollection.getAll([
            ['userId', 'in', batchIds],
          ]);
          const validTokens = userTokens
            .filter((tokenData: any) => tokenData.isActive !== false && typeof tokenData.token === 'string' && tokenData.token.trim().length > 0)
            .map((tokenData: any) => tokenData.token.trim());
          tokens.push(...validTokens);
        } catch (e) {
          console.warn('Error querying fcmTokens for batch:', e);
        }
      }
    }

    // Fallback: check target users' documents in users collection for fcmToken / fcmTokens
    if (userIds.length > 0) {
      const userDocs = await Promise.all(
        userIds.map((uid) => usersCollection.get(uid).catch(() => null))
      );
      for (const u of userDocs) {
        if (u) {
          if (typeof u.fcmToken === 'string' && u.fcmToken.trim().length > 0) {
            tokens.push(u.fcmToken.trim());
          }
          if (Array.isArray(u.fcmTokens)) {
            for (const t of u.fcmTokens) {
              if (typeof t === 'string' && t.trim().length > 0) {
                tokens.push(t.trim());
              }
            }
          }
        }
      }
    }

    return Array.from(new Set(tokens));
  } catch (error: any) {
    console.error('Error getting FCM tokens:', error);
    return Array.from(new Set(tokens));
  }
};

const createUserNotificationDocuments = async (
  notification: Notification,
  userIds: string[]
): Promise<number> => {
  try {
    const currentUserId = auth.currentUser?.uid || '';
    const BATCH_SIZE = 500;
    const batches: string[][] = [];
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      batches.push(userIds.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchPromises = batch.map((userId) =>
        notificationsCollection.create({
          userId,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          read: false,
          isRead: false,
          createdBy: notification.createdBy || currentUserId,
          targetAudience: notification.targetAudience || 'Venue Users',
          ...(notification.targetVenueId ? { targetVenueId: notification.targetVenueId } : {}),
          ...(notification.actionUrl ? { actionUrl: notification.actionUrl } : {}),
          ...(notification.actionText ? { actionText: notification.actionText } : {}),
          ...(notification.imageUrl ? { imageUrl: notification.imageUrl } : {}),
          data: {
            type: notification.type,
            notificationId: notification.id,
            ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
          },
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(batchPromises);
    }

    console.log(`Created ${userIds.length} user notification documents`);
    return userIds.length;
  } catch (error: any) {
    console.error('Error creating user notification documents:', error);
    return 0;
  }
};

const getTargetUserIds = async (
  targetAudience: Notification['targetAudience'],
  targetUserIds?: string[],
  targetVenueId?: string
): Promise<string[]> => {
  try {
    let userIds: string[] = [];

    if (targetAudience === 'All Users') {
      const allUsers = await usersCollection.getAll();
      userIds = allUsers.map((user: any) => user.id);
    } else if (targetAudience === 'Venue Managers') {
      const managers = await usersCollection.getAll([['role', '==', 'venue_manager']]);
      userIds = managers.map((user: any) => user.id);
    } else if (targetAudience === 'Specific Users' && targetUserIds && targetUserIds.length > 0) {
      userIds = targetUserIds;
    } else if (targetAudience === 'Venue Users' && targetVenueId) {
      const allUsers = await usersCollection.getAll();
      const profileUserIds = allUsers
        .filter(
          (user: any) =>
            user.venueIds?.includes(targetVenueId) ||
            user.managedVenues?.includes(targetVenueId) ||
            user.venueId === targetVenueId ||
            user.primaryVenueId === targetVenueId
        )
        .map((user: any) => user.id);
      const venueBookings = await bookingsCollection.getAll([
        ['venueId', '==', targetVenueId],
      ]);
      const customerIds = venueBookings
        .map((booking: any) => booking.userId || booking.user?.id)
        .filter((userId: unknown): userId is string => typeof userId === 'string' && userId.length > 0);
      userIds = [...profileUserIds, ...customerIds];
    }

    return Array.from(new Set(userIds));
  } catch (error: any) {
    console.error('Error getting target user IDs:', error);
    return [];
  }
};

const getTargetPhoneNumbers = async (userIds: string[]): Promise<string[]> => {
  const users = await Promise.all(userIds.map((userId) => usersCollection.get(userId)));
  return Array.from(new Set(users
    .map((user: any) => String(user?.phone || '').replace(/[^\d+]/g, ''))
    .filter(Boolean)
    .map((phone) => {
      if (phone.startsWith('+')) return phone;
      if (phone.length === 10) return `+91${phone}`;
      return `+${phone.replace(/^0+/, '')}`;
    })));
};

/**
 * Send notification to target audience via configured channels (push / WhatsApp).
 */
export const sendNotificationToAudience = async (
  notification: Notification,
  channels: ('push' | 'whatsapp')[] = ['push']
): Promise<{ success: number; failed: number; whatsappResult?: { success: number; failed: number } }> => {
  try {
    let pushResult = { success: 0, failed: 0 };
    let whatsappResult = { success: 0, failed: 0 };

    const targetUserIds = await getTargetUserIds(
      notification.targetAudience,
      notification.targetUserIds,
      notification.targetVenueId
    );
    // The in-app inbox is a delivery channel of its own. Create these records
    // even when a user denied push permission or has no active FCM token.
    const inAppCreated = targetUserIds.length > 0
      ? await createUserNotificationDocuments(notification, targetUserIds)
      : 0;

    if (channels.includes('push')) {
      try {
        const tokens = await getTargetFCMTokens(
          notification.targetAudience,
          notification.targetUserIds,
          notification.targetVenueId
        );

        if (tokens.length > 0) {
          pushResult = await sendPushNotification(notification, tokens);
        } else {
          console.warn('No FCM tokens found for target audience');
          pushResult = { success: 0, failed: targetUserIds.length };
        }
      } catch (error: any) {
        console.error('Error sending push notification:', error);
        pushResult = { success: 0, failed: targetUserIds.length };
      }
    }

    if (channels.includes('whatsapp')) {
      try {
        const appSettings = (await appSettingsCollection.get()) as AppSettings | null;
        const whatsappConfig = appSettings?.integrations?.whatsapp;

        if (whatsappConfig?.enabled && whatsappConfig?.status === 'Connected') {
          if (targetUserIds.length > 0) {
            const phoneNumbers = await getTargetPhoneNumbers(targetUserIds);
            const message = `${notification.title}\n\n${notification.body}`;
            const results = await Promise.allSettled(
              phoneNumbers.map((phone) => sendTrustedWhatsAppMessage(phone, message))
            );
            whatsappResult = {
              success: results.filter((result) => result.status === 'fulfilled').length,
              failed: results.filter((result) => result.status === 'rejected').length,
            };
          }
        } else if (channels.includes('whatsapp')) {
          whatsappResult = { success: 0, failed: targetUserIds.length };
        }
      } catch (error: any) {
        console.error('Error sending WhatsApp notification:', error);
      }
    }

    return {
      success: Math.max(pushResult.success, whatsappResult.success, inAppCreated),
      failed: pushResult.failed + whatsappResult.failed,
      whatsappResult,
    };
  } catch (error: any) {
    console.error('Error sending notification to audience:', error);
    throw error;
  }
};
