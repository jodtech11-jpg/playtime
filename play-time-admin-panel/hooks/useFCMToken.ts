import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFCMToken, onForegroundMessage, MessagePayload } from '../services/firebase';
import { fcmTokensCollection } from '../services/firebase';
import { FCMToken } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { registerServiceWorker } from '../utils/serviceWorkerRegistration';

/**
 * Hook for managing FCM token registration and foreground messages
 */
export const useFCMToken = () => {
  const { user } = useAuth();
  const { showInfo } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Register FCM token for the current user
   */
  const registerToken = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Register service worker first
      await registerServiceWorker();
      
      // Get FCM token
      const fcmToken = await getFCMToken();
      
      if (!fcmToken) {
        setError('Failed to get FCM token. Please enable notifications.');
        setIsRegistering(false);
        return;
      }

      setToken(fcmToken);

      // Check if token already exists
      const existingTokens = await fcmTokensCollection.getAll([
        ['userId', '==', user.id],
        ['token', '==', fcmToken],
        ['isActive', '==', true]
      ]);

      if (existingTokens.length > 0) {
        // Token already registered, update lastUsedAt
        const existingToken = existingTokens[0] as FCMToken;
        await fcmTokensCollection.update(existingToken.id, {
          lastUsedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setIsRegistering(false);
        return;
      }

      // Create new token record
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      };

      const tokenData: Omit<FCMToken, 'id'> = {
        userId: user.id,
        token: fcmToken,
        deviceType: 'web',
        deviceInfo,
        isActive: true,
        lastUsedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await fcmTokensCollection.create(tokenData);
      setIsRegistering(false);
    } catch (err: any) {
      console.error('Error registering FCM token:', err);
      setError(err.message || 'Failed to register FCM token');
      setIsRegistering(false);
    }
  }, [user]);

  /**
   * Unregister FCM token (mark as inactive)
   */
  const unregisterToken = useCallback(async () => {
    if (!user || !token) {
      return;
    }

    try {
      const existingTokens = await fcmTokensCollection.getAll([
        ['userId', '==', user.id],
        ['token', '==', token]
      ]);

      for (const existingToken of existingTokens) {
        await fcmTokensCollection.update(existingToken.id, {
          isActive: false,
          updatedAt: serverTimestamp()
        });
      }

      setToken(null);
    } catch (err: any) {
      console.error('Error unregistering FCM token:', err);
    }
  }, [user, token]);

  /**
   * Set up foreground message listener
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = onForegroundMessage((payload: MessagePayload) => {
      console.log('Foreground message received:', payload);
      
      // Show toast notification
      if (payload.notification) {
        showInfo(payload.notification.title || 'New notification');
      }

      // Handle notification click
      if (payload.data?.actionUrl) {
        // Navigate to action URL if needed
        // You can use react-router-dom's useNavigate here if needed
        console.log('Action URL:', payload.data.actionUrl);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, showInfo]);

  /**
   * Register token when user logs in
   */
  useEffect(() => {
    if (user) {
      registerToken();
    } else {
      // Unregister when user logs out
      unregisterToken();
    }
  }, [user, registerToken, unregisterToken]);

  return {
    token,
    isRegistering,
    error,
    registerToken,
    unregisterToken
  };
};

