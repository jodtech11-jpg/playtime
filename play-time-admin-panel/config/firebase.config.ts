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
 * Validate that all required Firebase config values are present
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

