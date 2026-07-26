import { useCallback, useEffect, useMemo, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { notificationsCollection } from '../services/firebase';
import { Notification } from '../types';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

type InboxNotification = Notification & {
  userId?: string;
  read?: boolean;
  isRead?: boolean;
  actionUrl?: string;
  bookingId?: string;
  data?: Record<string, unknown>;
};

const createdAtMillis = (notification: InboxNotification): number =>
  notification.createdAt?.toMillis?.() ??
  ((notification.createdAt?.seconds ?? 0) * 1000);

export const useInboxNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    setError(null);
    return notificationsCollection.subscribeAll(
      (rows: InboxNotification[]) => {
        setNotifications(
          [...rows].sort((a, b) => createdAtMillis(b) - createdAtMillis(a))
        );
      },
      [{ field: 'userId', operator: '==', value: user.id }],
      undefined,
      undefined,
      (subscriptionError: unknown) =>
        setError(
          getFirebaseErrorMessage(
            subscriptionError,
            'Failed to load your notification inbox'
          )
        )
    );
  }, [user?.id]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await notificationsCollection.update(notificationId, {
      read: true,
      isRead: true,
      readAt: serverTimestamp(),
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter(
      (notification) => notification.read !== true && notification.isRead !== true
    );
    await Promise.all(unread.map((notification) => markAsRead(notification.id)));
  }, [markAsRead, notifications]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          notification.read !== true && notification.isRead !== true
      ).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    error,
    markAsRead,
    markAllAsRead,
  };
};
