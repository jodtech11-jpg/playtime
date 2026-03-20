import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { auth } from '../services/firebase';
import { reauthenticateWithCredential, EmailAuthProvider, signInWithPhoneNumber, PhoneAuthProvider, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';

interface VenueTwoStepAuthContextType {
  isVerified: boolean;
  verifyWithPassword: (password: string) => Promise<boolean>;
  sendOTP: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyWithOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<boolean>;
  clearVerification: () => void;
  verificationMethod: 'password' | 'otp' | null;
  setVerificationMethod: (method: 'password' | 'otp' | null) => void;
}

const VenueTwoStepAuthContext = createContext<VenueTwoStepAuthContextType | undefined>(undefined);

interface VenueTwoStepAuthProviderProps {
  children: ReactNode;
}

export const VenueTwoStepAuthProvider: React.FC<VenueTwoStepAuthProviderProps> = ({ children }) => {
  const { user, firebaseUser } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'password' | 'otp' | null>(null);
  const [verificationExpiry, setVerificationExpiry] = useState<number | null>(null);
  const [originalUserUid, setOriginalUserUid] = useState<string | null>(null);

  // Check if verification is still valid (15 minutes expiry)
  const isVerificationValid = () => {
    if (!verificationExpiry) return false;
    return Date.now() < verificationExpiry;
  };

  // Store original user UID when component mounts
  React.useEffect(() => {
    if (firebaseUser && !originalUserUid) {
      setOriginalUserUid(firebaseUser.uid);
    }
  }, [firebaseUser, originalUserUid]);

  // Clear verification after expiry or manual clear
  React.useEffect(() => {
    if (verificationExpiry && Date.now() >= verificationExpiry) {
      setIsVerified(false);
      setVerificationExpiry(null);
    }
  }, [verificationExpiry]);

  const verifyWithPassword = async (password: string): Promise<boolean> => {
    try {
      if (!firebaseUser || !user?.email) {
        throw new Error('User not authenticated');
      }

      // Re-authenticate user with password
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Set verification state with 15-minute expiry
      setIsVerified(true);
      setVerificationExpiry(Date.now() + 15 * 60 * 1000); // 15 minutes
      setVerificationMethod('password');
      return true;
    } catch (error: any) {
      console.error('Password verification error:', error);
      throw new Error(error.message || 'Invalid password. Please try again.');
    }
  };

  const sendOTP = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
    try {
      if (!phoneNumber || !phoneNumber.trim()) {
        throw new Error('Phone number is required');
      }

      // Format phone number (ensure it starts with +)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

      // Send OTP using Firebase Phone Authentication
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
      return confirmationResult;
    } catch (error: any) {
      console.error('OTP send error:', error);
      throw new Error(error.message || 'Failed to send OTP. Please try again.');
    }
  };

  const verifyWithOTP = async (confirmationResult: ConfirmationResult, otp: string): Promise<boolean> => {
    try {
      if (!otp || otp.length !== 6) {
        throw new Error('Invalid OTP code. Please enter a 6-digit code.');
      }

      if (!firebaseUser || !user || !originalUserUid) {
        throw new Error('User not authenticated. Please log in again.');
      }

      const storedOriginalUid = originalUserUid;
      const userPhoneNumber = user.phone?.startsWith('+') ? user.phone : user.phone ? `+${user.phone}` : null;

      if (!userPhoneNumber) {
        throw new Error('Phone number not found in your profile. Please use password verification.');
      }

      // Verify OTP code with Firebase
      // Note: This will sign in with the phone number, which may be a different user
      const userCredential = await confirmationResult.confirm(otp);
      
      // After OTP verification, Firebase signs in with the phone number
      // We need to verify the phone number matches the user's registered phone
      const verifiedPhoneNumber = userCredential.user.phoneNumber;

      if (!verifiedPhoneNumber) {
        await auth.signOut();
        throw new Error('Phone verification failed. No phone number found in verification result.');
      }

      // Normalize phone numbers for comparison (remove spaces, dashes, etc.)
      const normalizePhone = (phone: string) => phone.replace(/[\s\-\(\)]/g, '');
      const normalizedVerified = normalizePhone(verifiedPhoneNumber);
      const normalizedUser = normalizePhone(userPhoneNumber);

      // Verify phone numbers match
      if (normalizedVerified === normalizedUser) {
        // Phone matches - verify the user UID also matches (if phone is linked to same account)
        // If the phone auth signed in as a different user, we need to restore the original session
        const currentUid = auth.currentUser?.uid;
        
        if (currentUid === storedOriginalUid) {
          // Same user - phone is already linked to this account, verification successful
          setIsVerified(true);
          setVerificationExpiry(Date.now() + 15 * 60 * 1000); // 15 minutes
          setVerificationMethod('otp');
          return true;
        } else {
          // Different user - phone is linked to a different account
          // This means the phone number in the user's profile doesn't match their Firebase Auth phone
          // We should still allow verification if phone numbers match (user may have updated phone in profile but not in Auth)
          // But we need to restore the original session
          
          // Sign out the phone auth session
          await auth.signOut();
          
          // The AuthContext will detect the sign out and handle it
          // For now, we'll set verification state but the user will need to log in again
          // In a production system, you'd want to restore the session using stored credentials
          
          throw new Error('Phone number verification successful, but session restoration failed. Please log in again.');
        }
      } else {
        // Phone doesn't match - sign out and throw error
        await auth.signOut();
        throw new Error('Phone verification failed. The verified phone number does not match your account.');
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      
      // Ensure we sign out if there was an error and we're not the original user
      try {
        const currentUid = auth.currentUser?.uid;
        if (currentUid && currentUid !== originalUserUid) {
          await auth.signOut();
        }
      } catch (signOutError) {
        // Ignore sign out errors
      }
      
      // Handle specific Firebase errors
      if (error.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid OTP code. Please check and try again.');
      } else if (error.code === 'auth/code-expired') {
        throw new Error('OTP code has expired. Please request a new code.');
      } else if (error.code === 'auth/session-expired') {
        throw new Error('OTP session expired. Please request a new code.');
      } else {
        throw new Error(error.message || 'Invalid OTP code. Please try again.');
      }
    }
  };

  const clearVerification = () => {
    setIsVerified(false);
    setVerificationExpiry(null);
    setVerificationMethod(null);
  };

  // Check if verification is still valid
  const verified = isVerified && isVerificationValid();

  const value: VenueTwoStepAuthContextType = {
    isVerified: verified,
    verifyWithPassword,
    sendOTP,
    verifyWithOTP,
    clearVerification,
    verificationMethod,
    setVerificationMethod,
  };

  return (
    <VenueTwoStepAuthContext.Provider value={value}>
      {children}
    </VenueTwoStepAuthContext.Provider>
  );
};

export const useVenueTwoStepAuth = (): VenueTwoStepAuthContextType => {
  const context = useContext(VenueTwoStepAuthContext);
  if (context === undefined) {
    throw new Error('useVenueTwoStepAuth must be used within a VenueTwoStepAuthProvider');
  }
  return context;
};

