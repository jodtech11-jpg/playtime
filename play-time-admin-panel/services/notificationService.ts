import { fcmTokensCollection, usersCollection, appSettingsCollection, notificationsCollection } from './firebase';
import { FCMToken, Notification, AppSettings } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { sendWhatsAppNotification, getTargetPhoneNumbers, WhatsAppConfig } from './whatsappService';

/**
 * Send push notification using FCM REST API
 * Note: In production, this should be done via a Cloud Function using Admin SDK
 * This is a client-side implementation that requires the server key
 */
export const sendPushNotification = async (
  notification: Notification,
  fcmTokens: string[]
): Promise<{ success: number; failed: number }> => {
  if (fcmTokens.length === 0) {
    return { success: 0, failed: 0 };
  }

  // For production, this should call a Cloud Function endpoint
  // that uses Firebase Admin SDK to send notifications securely
  const cloudFunctionUrl = import.meta.env.VITE_FCM_CLOUD_FUNCTION_URL;
  
  if (cloudFunctionUrl) {
    // Call Cloud Function
    try {
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          tokens: fcmTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success || 0,
        failed: result.failed || fcmTokens.length,
      };
    } catch (error: any) {
      console.error('Error sending notification via Cloud Function:', error);
      throw error;
    }
  } else {
    // Fallback: Direct FCM REST API call (requires server key in env)
    // WARNING: This exposes the server key on the client side - NOT RECOMMENDED for production
    const serverKey = import.meta.env.VITE_FCM_SERVER_KEY;
    
    if (!serverKey) {
      // Return a graceful error instead of throwing
      // This allows the notification to be saved even if push fails
      console.warn('FCM server key not configured. Push notifications will not be sent.');
      console.warn('To enable push notifications:');
      console.warn('1. Set up a Cloud Function (recommended) and add VITE_FCM_CLOUD_FUNCTION_URL to .env');
      console.warn('2. OR add VITE_FCM_SERVER_KEY to .env (not recommended for production)');
      return { success: 0, failed: fcmTokens.length };
    }

    try {
      // Send to multiple tokens using FCM REST API
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${serverKey}`,
        },
        body: JSON.stringify({
          registration_ids: fcmTokens,
          notification: {
            title: notification.title,
            body: notification.body,
            image: notification.imageUrl,
          },
          data: {
            type: notification.type,
            actionUrl: notification.actionUrl || '',
            actionText: notification.actionText || '',
            notificationId: notification.id,
          },
          priority: 'high',
        }),
      });

      if (!response.ok) {
        throw new Error(`FCM API error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Count successful and failed
      let success = 0;
      let failed = 0;
      
      if (result.results) {
        result.results.forEach((result: any) => {
          if (result.error) {
            failed++;
          } else {
            success++;
          }
        });
      }

      return { success, failed };
    } catch (error: any) {
      console.error('Error sending notification via FCM API:', error);
      throw error;
    }
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
  const filters: any[] = [['isActive', '==', true]];

  try {
    if (targetAudience === 'All Users') {
      // Get all active tokens
      const allTokens = await fcmTokensCollection.getAll(filters);
      tokens.push(...allTokens.map((token: FCMToken) => token.token));
    } else if (targetAudience === 'Venue Managers') {
      // Get users with venue_manager role
      const managers = await usersCollection.getAll([['role', '==', 'venue_manager']]);
      const managerIds = managers.map((user: any) => user.id);
      
      if (managerIds.length > 0) {
        const managerTokens = await fcmTokensCollection.getAll([
          ['isActive', '==', true],
          ['userId', 'in', managerIds]
        ]);
        tokens.push(...managerTokens.map((token: FCMToken) => token.token));
      }
    } else if (targetAudience === 'Specific Users' && targetUserIds && targetUserIds.length > 0) {
      // Get tokens for specific users
      const userTokens = await fcmTokensCollection.getAll([
        ['isActive', '==', true],
        ['userId', 'in', targetUserIds]
      ]);
      tokens.push(...userTokens.map((token: FCMToken) => token.token));
    } else if (targetAudience === 'Venue Users' && targetVenueId) {
      // Get users associated with a specific venue
      // This would require a venue membership or booking relationship
      // For now, we'll get all users and filter by venue association
      // You may need to adjust this based on your data model
      const allUsers = await usersCollection.getAll();
      const venueUserIds = allUsers
        .filter((user: any) => 
          user.venueIds?.includes(targetVenueId) || 
          user.managedVenues?.includes(targetVenueId)
        )
        .map((user: any) => user.id);
      
      if (venueUserIds.length > 0) {
        const venueTokens = await fcmTokensCollection.getAll([
          ['isActive', '==', true],
          ['userId', 'in', venueUserIds]
        ]);
        tokens.push(...venueTokens.map((token: FCMToken) => token.token));
      }
    }

    // Remove duplicates
    return Array.from(new Set(tokens));
  } catch (error: any) {
    console.error('Error getting FCM tokens:', error);
    throw error;
  }
};

/**
 * Create per-user notification documents in Firestore
 */
const createUserNotificationDocuments = async (
  notification: Notification,
  userIds: string[]
): Promise<void> => {
  try {
    // Limit batch size to avoid overwhelming Firestore
    const BATCH_SIZE = 500;
    const batches = [];
    
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      batches.push(batch);
    }

    // Process batches sequentially to avoid rate limits
    for (const batch of batches) {
      // Create notification documents for each user in this batch
      const batchPromises = batch.map(userId => 
        notificationsCollection.create({
          userId: userId,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          read: false,
          // Store action fields at root level for mobile app compatibility
          actionUrl: notification.actionUrl || undefined,
          actionText: notification.actionText || undefined,
          imageUrl: notification.imageUrl || undefined,
          // Store additional data in data field for future use
          data: {
            type: notification.type,
            notificationId: notification.id,
            ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
          },
          createdAt: serverTimestamp(),
        })
      );

      // Execute batch creates in parallel
      await Promise.all(batchPromises);
    }
    
    console.log(`Created ${userIds.length} user notification documents`);
  } catch (error: any) {
    console.error('Error creating user notification documents:', error);
    // Don't throw - notification sending should continue even if document creation fails
  }
};

/**
 * Get user IDs for target audience
 */
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
      userIds = allUsers
        .filter((user: any) => 
          user.venueIds?.includes(targetVenueId) || 
          user.managedVenues?.includes(targetVenueId)
        )
        .map((user: any) => user.id);
    }

    return userIds;
  } catch (error: any) {
    console.error('Error getting target user IDs:', error);
    return [];
  }
};

/**
 * Send notification to target audience
 */
export const sendNotificationToAudience = async (
  notification: Notification,
  channels: ('push' | 'whatsapp')[] = ['push']
): Promise<{ success: number; failed: number; whatsappResult?: { success: number; failed: number } }> => {
  try {
    let pushResult = { success: 0, failed: 0 };
    let whatsappResult = { success: 0, failed: 0 };

    // Get target user IDs for creating notification documents
    const targetUserIds = await getTargetUserIds(
      notification.targetAudience,
      notification.targetUserIds,
      notification.targetVenueId
    );

    // Send push notifications if enabled
    if (channels.includes('push')) {
      try {
        const tokens = await getTargetFCMTokens(
          notification.targetAudience,
          notification.targetUserIds,
          notification.targetVenueId
        );

        if (tokens.length > 0) {
          pushResult = await sendPushNotification(notification, tokens);
          
          // Create per-user notification documents after successful push
          // Only create if at least some notifications were sent
          if (pushResult.success > 0 && targetUserIds.length > 0) {
            await createUserNotificationDocuments(notification, targetUserIds);
          }
        } else {
          console.warn('No FCM tokens found for target audience');
        }
      } catch (error: any) {
        console.error('Error sending push notification:', error);
        // Don't throw - allow other channels (WhatsApp) to work even if push fails
        // This is a graceful degradation
        pushResult = { success: 0, failed: 0 };
        
        // If it's a configuration error, provide helpful message
        if (error.message?.includes('FCM server key not configured')) {
          console.warn('Push notifications are disabled. Configure FCM to enable them.');
        }
      }
    }

    // Send WhatsApp notifications if enabled
    if (channels.includes('whatsapp')) {
      try {
        // Get WhatsApp config from app settings
        const appSettings = await appSettingsCollection.get() as AppSettings | null;
        const whatsappConfig = appSettings?.integrations?.whatsapp;

        if (whatsappConfig?.enabled && whatsappConfig?.status === 'Connected') {
          if (targetUserIds.length > 0) {
            // Get phone numbers
            const phoneNumbers = await getTargetPhoneNumbers(targetUserIds);

            if (phoneNumbers.length > 0) {
              // Prepare WhatsApp config
              const config: WhatsAppConfig = {
                apiKey: whatsappConfig.apiKey || '',
                phoneNumberId: whatsappConfig.phoneNumberId || '',
                businessAccountId: whatsappConfig.businessAccountId || '',
                provider: 'whatsapp_business' // Default to WhatsApp Business API
              };

              // Send WhatsApp messages
              const whatsappMessage = `${notification.title}\n\n${notification.body}`;
              const result = await sendWhatsAppNotification(
                whatsappMessage,
                phoneNumbers,
                config
              );

              whatsappResult = {
                success: result.success,
                failed: result.failed
              };

              // Create per-user notification documents after successful WhatsApp send
              // Only create if at least some notifications were sent
              if (whatsappResult.success > 0 && targetUserIds.length > 0) {
                await createUserNotificationDocuments(notification, targetUserIds);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error sending WhatsApp notification:', error);
        // Don't throw - allow push notifications to succeed even if WhatsApp fails
      }
    }

    // If push notifications weren't sent but we have user IDs, still create notification documents
    // This ensures users see notifications even if push fails
    if (!channels.includes('push') && targetUserIds.length > 0) {
      await createUserNotificationDocuments(notification, targetUserIds);
    }

    return {
      success: pushResult.success + whatsappResult.success,
      failed: pushResult.failed + whatsappResult.failed,
      whatsappResult
    };
  } catch (error: any) {
    console.error('Error sending notification to audience:', error);
    throw error;
  }
};

