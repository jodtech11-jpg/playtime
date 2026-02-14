import { useState, useEffect } from 'react';
import { notificationsCollection } from '../services/firebase';
import { Notification } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { sendNotificationToAudience } from '../services/notificationService';

export interface SendNotificationOptions {
  channels?: ('push' | 'whatsapp')[];
}

export const useNotifications = (realtime: boolean = false) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        if (realtime) {
          try {
            unsubscribe = notificationsCollection.subscribeAll(
              (data: Notification[]) => {
                if (mounted) {
                  setNotifications(data || []);
                  setLoading(false);
                }
              },
              undefined,
              'createdAt',
              'desc'
            );
          } catch (subscribeError: any) {
            console.error('Error setting up subscription:', subscribeError);
            if (mounted) {
              setError(subscribeError.message || 'Failed to subscribe to notifications');
              // Fallback to non-realtime fetch
              try {
                const data = await notificationsCollection.getAll(
                  undefined,
                  'createdAt',
                  'desc'
                );
                if (mounted) {
                  setNotifications(data as Notification[]);
                  setLoading(false);
                }
              } catch (fetchError: any) {
                if (mounted) {
                  setLoading(false);
                }
              }
            }
          }
        } else {
          const data = await notificationsCollection.getAll(
            undefined,
            'createdAt',
            'desc'
          );
          if (mounted) {
            setNotifications(data as Notification[]);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching notifications:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch notifications');
          setLoading(false);
        }
      }
    };

    fetchNotifications();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [realtime]);

  const createNotification = async (notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newNotification = {
        ...notificationData,
        status: notificationData.status || 'Draft' as const,
      };
      
      const docId = await notificationsCollection.create(newNotification);
      return docId;
    } catch (err: any) {
      console.error('Error creating notification:', err);
      throw err;
    }
  };

  const updateNotification = async (notificationId: string, updates: Partial<Notification>) => {
    try {
      await notificationsCollection.update(notificationId, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Error updating notification:', err);
      throw err;
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await notificationsCollection.delete(notificationId);
    } catch (err: any) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  };

  const sendNotification = async (notificationId: string, options?: SendNotificationOptions) => {
    let result = { success: 0, failed: 0 };
    try {
      // Get notification
      const notification = await notificationsCollection.get(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      // Update status to 'Sending'
      await updateNotification(notificationId, { status: 'Sending' });

      // Send notification via selected channels
      const channels = options?.channels || ['push'];
      result = await sendNotificationToAudience(notification as Notification, channels);

      // Determine status based on results
      // If at least one notification was sent successfully, mark as 'Sent'
      // Only mark as 'Failed' if all notifications failed AND there were tokens to send
      const totalAttempted = result.success + result.failed;
      const status = totalAttempted > 0 && result.success > 0 ? 'Sent' : 
                     (totalAttempted > 0 && result.success === 0 ? 'Failed' : 'Sent');

      // Update notification with results
      await updateNotification(notificationId, {
        status: status,
        sentAt: serverTimestamp(),
        sentCount: result.success,
        failedCount: result.failed,
      });

      return result;
    } catch (err: any) {
      console.error('Error sending notification:', err);
      // Only mark as 'Failed' if no notifications were sent successfully
      // If some were sent, mark as 'Sent' with failed count
      const status = result.success > 0 ? 'Sent' : 'Failed';
      await updateNotification(notificationId, { 
        status: status,
        sentCount: result.success,
        failedCount: result.failed,
      });
      // Only throw error if it's a critical error, not if some notifications were sent
      if (result.success === 0) {
        throw err;
      }
      return result;
    }
  };

  return {
    notifications,
    loading,
    error,
    createNotification,
    updateNotification,
    deleteNotification,
    sendNotification,
  };
};

