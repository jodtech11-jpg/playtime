/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  /** Deployed `sendNotification` Cloud Function URL (admin-only, auth required). */
  readonly VITE_FCM_CLOUD_FUNCTION_URL?: string;
  /** Google Maps JS API key (restrict by HTTP referrer in Google Cloud). */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Razorpay public Key ID (client-side is safe; keep the secret on the server). */
  readonly VITE_RAZORPAY_KEY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
