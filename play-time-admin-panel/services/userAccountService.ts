import { auth, resetPassword } from './firebase';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

export interface CreateUserAccountPayload {
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  managedVenues?: string[];
  /** Extra permission grants beyond the role (super admin callers only). */
  customPermissions?: string[];
}

export interface UserAccountProvisionResult {
  uid: string;
  email: string;
  existingAuth: boolean;
  migrated: boolean;
  emailSent?: boolean;
  resetLink?: string | null;
}

/** Base URL for HTTPS Cloud Functions (same project as FCM functions). */
export const getCloudFunctionsBaseUrl = (): string => {
  const explicit = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const fcmUrl = import.meta.env.VITE_FCM_CLOUD_FUNCTION_URL;
  if (fcmUrl) {
    return fcmUrl.replace(/\/sendNotification\/?$/, '');
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'playtime-d9b83';
  return `https://us-central1-${projectId}.cloudfunctions.net`;
};

async function callAdminFunction<T>(path: string, body: object): Promise<T> {
  const baseUrl = getCloudFunctionsBaseUrl();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(`${baseUrl}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let message = errBody;
    try {
      const parsed = JSON.parse(errBody);
      message = parsed.error || parsed.message || errBody;
    } catch {
      // keep raw body
    }
    throw new Error(getFirebaseErrorMessage({ message }, `Request failed (${response.status})`));
  }

  return response.json() as Promise<T>;
}

/** Create Firebase Auth user + Firestore profile (Admin SDK via Cloud Function). */
export const createUserAccount = (payload: CreateUserAccountPayload) =>
  callAdminFunction<UserAccountProvisionResult>('createUserAccount', payload);

/** Link an existing Firestore user to Firebase Auth and migrate doc ID if needed. */
export const provisionUserLogin = (userId: string) =>
  callAdminFunction<UserAccountProvisionResult>('provisionUserLogin', { userId });

/**
 * Send Firebase password-reset email so the user can set their password.
 * Falls back to server-side send when provisionUserLogin already sent the email.
 */
export const sendPasswordSetupEmail = async (email: string): Promise<string | null> => {
  const { error } = await resetPassword(email);
  return error;
};

/** Provision login + send invite email via Cloud Function (preferred). */
export const sendLoginInvite = (userId: string) =>
  callAdminFunction<UserAccountProvisionResult>('provisionUserLogin', { userId, sendEmail: true });
