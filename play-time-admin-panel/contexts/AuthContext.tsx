import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  onAuthStateChange, 
  getCurrentUser, 
  signOutUser,
  resolveAdminUserProfile,
} from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { User, AuthContextType, LoadingState } from '../types';
import { deactivateCurrentFCMToken } from '../hooks/useFCMToken';
import { isAdminPanelRole, resolveEffectivePermissions, resolveRoleDisplayName } from '../utils/rbac';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

// Create context with a default value to prevent undefined errors
const defaultContextValue: AuthContextType = {
  user: null,
  firebaseUser: null,
  loading: 'loading',
  error: null,
  isAuthenticated: false,
  isSuperAdmin: false,
  isVenueManager: false,
  roleDisplayName: '',
  permissions: [],
  hasPermission: () => false,
  signOut: async () => {},
  refreshUser: async () => {},
  clearError: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContextValue);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleDisplayName, setRoleDisplayName] = useState('');
  const [loading, setLoading] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string, firebaseUser?: FirebaseUser | null) => {
    try {
      const authUser = firebaseUser ?? getCurrentUser();
      if (!authUser || authUser.uid !== uid) {
        setError('Failed to load user session. Please sign in again.');
        setLoading('loaded');
        return;
      }

      const profileResult = await resolveAdminUserProfile(authUser);

      // Guard against stale responses: the user may have signed out (or a
      // different account signed in) while the profile fetch was in flight.
      if (getCurrentUser()?.uid !== uid) {
        return;
      }

      if (profileResult.mismatch) {
        await signOutUser();
        setUser(null);
        setFirebaseUser(null);
        setError(
          `This Google account (${profileResult.email}) is registered with email and password. Please sign in with your password instead.`
        );
        setLoading('loaded');
        return;
      }

      const userData = profileResult.userData;
      if (userData) {
        if (userData.status === 'Pending') {
          await signOutUser();
          setUser(null);
          setFirebaseUser(null);
          setError(
            'Your account is pending approval. You will be able to sign in after a super admin approves your registration.'
          );
          setLoading('loaded');
          return;
        }
        if (userData.status === 'Inactive' || userData.status === 'Banned') {
          await signOutUser();
          setUser(null);
          setFirebaseUser(null);
          setError(
            userData.status === 'Banned'
              ? 'Your account has been banned. Please contact an administrator.'
              : 'Your account has been deactivated. Please contact an administrator.'
          );
          setLoading('loaded');
          return;
        }
        // Only admin roles may use the admin panel; player (mobile app)
        // accounts authenticate fine with Firebase but must be rejected here.
        // Custom roles are allowed when a matching roles/{roleId} document exists.
        const roleAllowed = await isAdminPanelRole(userData.role as string);
        if (!roleAllowed) {
          await signOutUser();
          setUser(null);
          setFirebaseUser(null);
          setError('This account does not have admin access. Please use the mobile app.');
          setLoading('loaded');
          return;
        }

        // Load effective permissions and display name in parallel.
        const [effectivePermissions, displayName] = await Promise.all([
          resolveEffectivePermissions(userData as User),
          resolveRoleDisplayName(userData.role as string),
        ]);

        // Re-check for stale response after the async permission fetch.
        if (getCurrentUser()?.uid !== uid) {
          return;
        }

        setError(null);
        setUser(userData as User);
        setPermissions(effectivePermissions);
        setRoleDisplayName(displayName);
        setLoading('loaded');
      } else {
        // User document doesn't exist – sign out so user isn't stuck
        console.warn('User document not found in Firestore for:', uid);
        await signOutUser();
        setUser(null);
        setFirebaseUser(null);
        setError(
          'No admin account found for this sign-in. If you use Google, your administrator must create your account with the same email, or sign in with email and password.'
        );
        setLoading('loaded');
      }
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      // Clear any previously loaded profile so a failed fetch can't leave a
      // stale user paired with a different Firebase session.
      setUser(null);
      setPermissions([]);
      setRoleDisplayName('');
      setError(getFirebaseErrorMessage(err, 'Failed to load user data'));
      setLoading('error');
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (!mounted) return;
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        setLoading('loading');
        setError(null);
        await fetchUserData(firebaseUser.uid, firebaseUser);
      } else {
        setUser(null);
        setPermissions([]);
        setRoleDisplayName('');
        setLoading('loaded');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Sign out function
  const signOut = async () => {
    try {
      setLoading('loading');
      // Deactivate this device's FCM token while we still have auth;
      // after signOutUser() the Firestore write would be rejected.
      await deactivateCurrentFCMToken();
      await signOutUser();
      setUser(null);
      setPermissions([]);
      setRoleDisplayName('');
      setFirebaseUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Error signing out:', err);
      setError(getFirebaseErrorMessage(err, 'Failed to sign out'));
    } finally {
      setLoading('loaded');
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserData(firebaseUser.uid, firebaseUser);
    }
  };

  const clearError = () => setError(null);

  const isSuperAdmin = user?.role === 'super_admin';

  // Super admins hold every permission implicitly; everyone else is limited
  // to their effective permission set (role permissions + custom grants).
  const hasPermission = (...permissionIds: string[]): boolean => {
    if (isSuperAdmin) return true;
    if (!user) return false;
    return permissionIds.every((id) => {
      if (permissions.includes(id)) return true;
      // `resource.manage` implies `resource.read`
      if (id.endsWith('.read')) {
        const manageId = `${id.slice(0, -'.read'.length)}.manage`;
        if (permissions.includes(manageId)) return true;
      }
      return false;
    });
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    error,
    signOut,
    refreshUser,
    clearError,
    // `user` is only set for roles that passed the admin-panel gate
    // (super_admin, venue_manager, or a custom role with a roles/{id} doc).
    isAuthenticated:
      !!firebaseUser &&
      !!user &&
      user.status !== 'Pending' &&
      user.status !== 'Inactive' &&
      user.status !== 'Banned' &&
      user.role !== 'player',
    isSuperAdmin,
    // Venue managers and custom-role admins are both venue/vendor scoped.
    isVenueManager: !!user && user.role !== 'super_admin' && user.role !== 'player',
    roleDisplayName,
    permissions,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  return useContext(AuthContext);
};

