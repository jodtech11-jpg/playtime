import { useState, useEffect } from 'react';
import { notificationsCollection } from '../services/firebase';
import { Notification } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { sendNotificationToAudience } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

export interface SendNotificationOptions {
  channels?: ('push' | 'whatsapp')[];
}

const sortByCreatedDesc = (rows: Notification[]) =>
  [...rows].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });

export const useNotifications = (realtime: boolean = false) => {
  const { user, isVenueManager, isSuperAdmin } = useAuth();
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

        if (!user) {
          if (mounted) {
            setNotifications([]);
            setLoading(false);
          }
          return;
        }

        // Vendors only see notifications they created; super admins see all broadcasts.
        const filters: { field: string; operator: string; value: unknown }[] = [];
        if (isVenueManager && !isSuperAdmin) {
          filters.push({ field: 'createdBy', operator: '==', value: user.id });
        }

        const applyBroadcastFilter = (data: Notification[]) =>
          sortByCreatedDesc((data || []).filter((n: any) => !n.userId));

        if (realtime) {
          unsubscribe = notificationsCollection.subscribeAll(
            (data: Notification[]) => {
              if (mounted) {
                setNotifications(applyBroadcastFilter(data));
                setLoading(false);
              }
            },
            filters.length > 0 ? filters : undefined,
            undefined,
            undefined,
            (subscriptionError: unknown) => {
              if (mounted) {
                setError(
                  getFirebaseErrorMessage(
                    subscriptionError,
                    'Failed to subscribe to notifications'
                  )
                );
                setLoading(false);
              }
            }
          );
        } else {
          const data = await notificationsCollection.getAll(
            filters.length > 0 ? filters : undefined
          );
          if (mounted) {
            setNotifications(applyBroadcastFilter(data as Notification[]));
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching notifications:', err);
        if (mounted) {
          setError(getFirebaseErrorMessage(err, 'Failed to fetch notifications'));
          setLoading(false);
        }
      }
    };

    fetchNotifications();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [realtime, user?.id, isVenueManager, isSuperAdmin]);

  const createNotification = async (notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newNotification = {
        ...notificationData,
        status: notificationData.status || ('Draft' as const),
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
      const notification = await notificationsCollection.get(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      await updateNotification(notificationId, { status: 'Sending' });

      const channels = options?.channels || ['push'];
      result = await sendNotificationToAudience(notification as Notification, channels);

      const status = result.success > 0 ? 'Sent' : 'Failed';

      await updateNotification(notificationId, {
        status,
        sentAt: serverTimestamp(),
        sentCount: result.success,
        failedCount: result.failed,
      });

      return result;
    } catch (err: any) {
      console.error('Error sending notification:', err);
      const status = result.success > 0 ? 'Sent' : 'Failed';
      await updateNotification(notificationId, {
        status,
        sentCount: result.success,
        failedCount: result.failed,
      });
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
