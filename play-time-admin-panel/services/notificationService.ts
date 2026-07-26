import { fcmTokensCollection, usersCollection, bookingsCollection, appSettingsCollection, notificationsCollection, auth } from './firebase';
import { FCMToken, Notification, AppSettings } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { sendWhatsAppNotification, getTargetPhoneNumbers, WhatsAppConfig } from './whatsappService';

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
    if (targetAudience === 'All Users') {
      const allTokens = await fcmTokensCollection.getAll([['isActive', '==', true]]);
      tokens.push(...allTokens.map((token: FCMToken) => token.token));
    } else {
      const userIds = await getTargetUserIds(
        targetAudience,
        targetUserIds,
        targetVenueId
      );
      for (let index = 0; index < userIds.length; index += 30) {
        const userTokens = await fcmTokensCollection.getAll([
          ['isActive', '==', true],
          ['userId', 'in', userIds.slice(index, index + 30)],
        ]);
        tokens.push(...userTokens.map((token: FCMToken) => token.token));
      }
    }

    return Array.from(new Set(tokens));
  } catch (error: any) {
    console.error('Error getting FCM tokens:', error);
    throw error;
  }
};

const createUserNotificationDocuments = async (
  notification: Notification,
  userIds: string[]
): Promise<number> => {
  try {
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
            user.managedVenues?.includes(targetVenueId)
        )
        .map((user: any) => user.id);
      const venueBookings = await bookingsCollection.getAll([
        ['venueId', '==', targetVenueId],
      ]);
      const customerIds = venueBookings
        .map((booking: any) => booking.userId)
        .filter((userId: unknown): userId is string => typeof userId === 'string' && userId.length > 0);
      userIds = [...profileUserIds, ...customerIds];
    }

    return Array.from(new Set(userIds));
  } catch (error: any) {
    console.error('Error getting target user IDs:', error);
    return [];
  }
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

            if (phoneNumbers.length > 0) {
              const config: WhatsAppConfig = {
                apiKey: whatsappConfig.apiKey || '',
                phoneNumberId: whatsappConfig.phoneNumberId || '',
                businessAccountId: whatsappConfig.businessAccountId || '',
                provider: 'whatsapp_business',
              };

              const whatsappMessage = `${notification.title}\n\n${notification.body}`;
              const result = await sendWhatsAppNotification(whatsappMessage, phoneNumbers, config);

              whatsappResult = { success: result.success, failed: result.failed };
            }
          }
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
