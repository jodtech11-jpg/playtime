/**
 * Firebase Configuration
 * 
 * This file exports Firebase configuration values.
 * In production, these should come from environment variables.
 * 
 * To set up:
 * 1. Create a .env file in the root directory
 * 2. Add your Firebase config values (see .env.example)
 * 3. Update vite.config.ts to load environment variables
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "playtime-d9b83",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

/**
 * Validate that all required Firebase config values are present.
 * Returns false if any required key is missing.
 */
export const validateFirebaseConfig = (): boolean => {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

  if (missing.length > 0) {
    console.warn('Missing Firebase config values:', missing);
    console.warn('Please set these in your .env file');
    return false;
  }

  return true;
};

/**
 * Validate Firebase config and throw in production if invalid.
 * In development only logs a warning.
 */
export const validateFirebaseConfigOrThrow = (): void => {
  const valid = validateFirebaseConfig();
  if (!valid && !import.meta.env.DEV) {
    throw new Error(
      'Missing required Firebase config. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID in your .env file. See .env.example or docs/guides/ENV_SETUP.md.'
    );
  }
};

