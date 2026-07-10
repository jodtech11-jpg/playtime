import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFCMToken, onForegroundMessage } from '../services/firebase';
import type { MessagePayload } from 'firebase/messaging';
import { fcmTokensCollection } from '../services/firebase';
import { FCMToken } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { registerServiceWorker } from '../utils/serviceWorkerRegistration';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

// Snapshot of the last registered user/token, kept at module level so the
// token can be deactivated during sign-out (before Firebase auth is revoked,
// after which Firestore writes would be rejected).
let activeRegistration: { userId: string; token: string } | null = null;

/**
 * Deactivate the FCM token registered in this session. Must be called BEFORE
 * Firebase sign-out; afterwards the Firestore write would be permission-denied.
 */
export const deactivateCurrentFCMToken = async (): Promise<void> => {
  const registration = activeRegistration;
  if (!registration) return;

  try {
    const existingTokens = await fcmTokensCollection.getAll([
      ['userId', '==', registration.userId],
      ['token', '==', registration.token]
    ]);

    for (const existingToken of existingTokens) {
      await fcmTokensCollection.update((existingToken as FCMToken).id, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
    }

    activeRegistration = null;
  } catch (err: any) {
    console.error('Error deactivating FCM token:', err);
  }
};

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
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          setIsRegistering(false);
          return;
        }
        setError('Failed to get FCM token. Please enable notifications.');
        setIsRegistering(false);
        return;
      }

      setToken(fcmToken);
      activeRegistration = { userId: user.id, token: fcmToken };

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
      setError(getFirebaseErrorMessage(err, 'Failed to register FCM token'));
      setIsRegistering(false);
    }
  }, [user]);

  /**
   * Unregister FCM token (mark as inactive)
   */
  const unregisterToken = useCallback(async () => {
    await deactivateCurrentFCMToken();
    setToken(null);
  }, []);

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

    return unsubscribe;
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

