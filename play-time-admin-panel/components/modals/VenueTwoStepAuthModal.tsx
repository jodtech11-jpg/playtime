import React, { useState, useEffect } from 'react';
import { useVenueTwoStepAuth } from '../../contexts/VenueTwoStepAuthContext';
import { useAuth } from '../../contexts/AuthContext';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from '../../services/firebase';

interface VenueTwoStepAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  requiredFor: string; // Description of what requires verification
}

const VenueTwoStepAuthModal: React.FC<VenueTwoStepAuthModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  requiredFor
}) => {
  const { verifyWithPassword, sendOTP, verifyWithOTP, setVerificationMethod, verificationMethod } = useVenueTwoStepAuth();
  const { user } = useAuth();
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setOtpCode('');
      setOtpSent(false);
      setError(null);
      setMethod(verificationMethod || 'password');
    }
  }, [isOpen, verificationMethod]);

  // Initialize reCAPTCHA for OTP
  useEffect(() => {
    if (method === 'otp' && !recaptchaVerifier && recaptchaContainerRef.current && isOpen) {
      try {
        if (recaptchaContainerRef.current.innerHTML) {
          recaptchaContainerRef.current.innerHTML = '';
        }

        const verifier = new RecaptchaVerifier(auth, 'venue-2fa-recaptcha', {
          size: 'normal',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please try again.');
          }
        });

        setRecaptchaVerifier(verifier);
      } catch (error: any) {
        console.error('Error initializing reCAPTCHA:', error);
        setError('Failed to initialize reCAPTCHA. Please refresh the page.');
      }
    }

    return () => {
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [method, recaptchaVerifier, isOpen]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyWithPassword(password);
      setVerificationMethod('password');
      onVerified();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!user?.phone) {
      setError('Phone number not found in your profile. Please use password verification or update your phone number.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (!recaptchaVerifier) {
        throw new Error('reCAPTCHA not initialized. Please refresh the page.');
      }

      // Format phone number
      const phoneNumber = user.phone.startsWith('+') ? user.phone : `+${user.phone}`;

      // Send OTP using the context method
      const result = await sendOTP(phoneNumber, recaptchaVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!confirmationResult) {
        throw new Error('OTP not sent. Please send OTP first.');
      }

      if (!otpCode || otpCode.length !== 6) {
        throw new Error('Please enter a valid 6-digit OTP code.');
      }

      // Verify OTP using the context method
      await verifyWithOTP(confirmationResult, otpCode);
      setVerificationMethod('otp');
      onVerified();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-gray-900">Two-Step Verification</h3>
              <p className="text-sm text-gray-500 mt-1">Required for: {requiredFor}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Method Selection */}
          <div className="mb-6">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Verification Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMethod('password');
                  setError(null);
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all ${
                  method === 'password'
                    ? 'border-primary bg-primary/10 text-primary font-black'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="material-symbols-outlined block mb-1">lock</span>
                <span className="text-sm">Password</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod('otp');
                  setError(null);
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all ${
                  method === 'otp'
                    ? 'border-primary bg-primary/10 text-primary font-black'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                disabled={!user?.phone}
              >
                <span className="material-symbols-outlined block mb-1">sms</span>
                <span className="text-sm">OTP</span>
                {!user?.phone && (
                  <span className="text-[9px] text-gray-400 block mt-1">No phone</span>
                )}
              </button>
            </div>
          </div>

          {/* Password Verification */}
          {method === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Enter Your Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your password"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  Please confirm your password to access venue features
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </form>
          )}

          {/* OTP Verification */}
          {method === 'otp' && (
            <div className="space-y-4">
              {!otpSent ? (
                <>
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      We'll send a verification code to <strong>{user?.phone || 'your phone'}</strong>
                    </p>
                    <div id="venue-2fa-recaptcha" ref={recaptchaContainerRef}></div>
                  </div>
                  <button
                    onClick={handleSendOTP}
                    disabled={loading || !user?.phone}
                    className="w-full px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                </>
              ) : (
                <form onSubmit={handleOTPSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                      Enter OTP Code
                    </label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl font-black tracking-widest"
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Enter the 6-digit code sent to {user?.phone}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setError(null);
                      }}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="flex-1 px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600">info</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-900 mb-1">Security Notice</p>
                <p className="text-xs text-amber-700">
                  Your verification will remain valid for 15 minutes. You'll need to verify again after this period.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueTwoStepAuthModal;

