import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  onAuthStateChange, 
  getCurrentUser, 
  signOutUser,
  usersCollection 
} from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { User, AuthContextType, LoadingState } from '../types';

// Create context with a default value to prevent undefined errors
const defaultContextValue: AuthContextType = {
  user: null,
  firebaseUser: null,
  loading: 'loading',
  error: null,
  isAuthenticated: false,
  isSuperAdmin: false,
  isVenueManager: false,
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
  const [loading, setLoading] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string) => {
    try {
      const userData = await usersCollection.get(uid);
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
        if (userData.status === 'Inactive') {
          await signOutUser();
          setUser(null);
          setFirebaseUser(null);
          setError('Your account has been deactivated. Please contact an administrator.');
          setLoading('loaded');
          return;
        }
        setError(null);
        setUser(userData as User);
        setLoading('loaded');
      } else {
        // User document doesn't exist – sign out so user isn't stuck
        console.warn('User document not found in Firestore for:', uid);
        await signOutUser();
        setUser(null);
        setFirebaseUser(null);
        setError('User profile not found. Please contact administrator.');
        setLoading('loaded');
      }
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to load user data');
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
        // Fetch user data from Firestore — guard against unmount during async fetch
        try {
          const userData = await usersCollection.get(firebaseUser.uid);
          if (!mounted) return;
          if (userData) {
            if (userData.status === 'Pending') {
              await signOutUser();
              if (!mounted) return;
              setFirebaseUser(null);
              setUser(null);
              setError(
                'Your account is pending approval. You will be able to sign in after a super admin approves your registration.'
              );
              setLoading('loaded');
              return;
            }
            if (userData.status === 'Inactive') {
              await signOutUser();
              if (!mounted) return;
              setFirebaseUser(null);
              setUser(null);
              setError('Your account has been deactivated. Please contact an administrator.');
              setLoading('loaded');
              return;
            }
            setError(null);
            setUser(userData as User);
            setLoading('loaded');
          } else {
            console.warn('User document not found in Firestore for:', firebaseUser.uid);
            await signOutUser();
            if (!mounted) return;
            setUser(null);
            setFirebaseUser(null);
            setError('User profile not found. Please contact administrator.');
            setLoading('loaded');
          }
        } catch (err: any) {
          if (!mounted) return;
          console.error('Error fetching user data:', err);
          setError(err.message || 'Failed to load user data');
          setLoading('error');
        }
      } else {
        setUser(null);
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
      await signOutUser();
      setUser(null);
      setFirebaseUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Error signing out:', err);
      setError(err.message || 'Failed to sign out');
    } finally {
      setLoading('loaded');
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserData(firebaseUser.uid);
    }
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    error,
    signOut,
    refreshUser,
    clearError,
    isAuthenticated:
      !!firebaseUser &&
      !!user &&
      user.status !== 'Pending' &&
      user.status !== 'Inactive',
    isSuperAdmin: user?.role === 'super_admin',
    isVenueManager: user?.role === 'venue_manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  return useContext(AuthContext);
};

