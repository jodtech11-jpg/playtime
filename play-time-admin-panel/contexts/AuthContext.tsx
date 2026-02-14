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
        setUser(userData as User);
        setLoading('loaded');
      } else {
        // User document doesn't exist, create it
        console.warn('User document not found in Firestore for:', uid);
        setLoading('loaded');
        setError('User profile not found. Please contact administrator.');
      }
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to load user data');
      setLoading('error');
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        setLoading('loading');
        setError(null);
        // Fetch user data from Firestore
        await fetchUserData(firebaseUser.uid);
      } else {
        setUser(null);
        setLoading('loaded');
      }
    });

    return () => unsubscribe();
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

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    error,
    signOut,
    refreshUser,
    isAuthenticated: !!firebaseUser && !!user,
    isSuperAdmin: user?.role === 'super_admin',
    isVenueManager: user?.role === 'venue_manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  return useContext(AuthContext);
};

