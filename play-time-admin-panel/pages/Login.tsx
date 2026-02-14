import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInEmailPassword, signInWithPhone, verifyOTP, signInWithGoogle, usersCollection, auth, createUserWithEmailAndPassword, resetPassword } from '../services/firebase';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import VendorSignupModal from '../components/VendorSignupModal';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone' | 'google'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && loading === 'loaded') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  // Initialize reCAPTCHA when phone auth is selected
  useEffect(() => {
    if (authMethod === 'phone' && !recaptchaVerifier && recaptchaContainerRef.current) {
      try {
        if (recaptchaContainerRef.current.innerHTML) {
          recaptchaContainerRef.current.innerHTML = '';
        }

        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'normal',
          callback: () => {},
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
        } catch (e) {}
      }
    };
  }, [authMethod, recaptchaVerifier]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { user: firebaseUser, error: authError } = await signInEmailPassword(email, password);
      
      if (authError) {
        setError(authError || 'Invalid email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      if (firebaseUser) {
        await verifyUserAndNavigate(firebaseUser);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!recaptchaVerifier) {
      setError('reCAPTCHA not initialized. Please refresh the page.');
      setIsLoading(false);
      return;
    }

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const { confirmationResult: result, error: phoneError } = await signInWithPhone(formattedPhone, recaptchaVerifier);
      
      if (phoneError) {
        setError(phoneError || 'Failed to send OTP. Please try again.');
        setIsLoading(false);
        return;
      }

      if (result) {
        setConfirmationResult(result);
        setOtpSent(true);
        setError(null);
      }
    } catch (err: any) {
      console.error('Phone auth error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!confirmationResult) {
      setError('OTP session expired. Please request a new OTP.');
      setIsLoading(false);
      return;
    }

    try {
      const { user: firebaseUser, error: otpError } = await verifyOTP(confirmationResult, otpCode);
      
      if (otpError) {
        setError(otpError || 'Invalid OTP. Please try again.');
        setIsLoading(false);
        return;
      }

      if (firebaseUser) {
        await verifyUserAndNavigate(firebaseUser);
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { user: firebaseUser, error: googleError } = await signInWithGoogle();
      
      if (googleError) {
        setError(googleError || 'Failed to sign in with Google. Please try again.');
        setIsLoading(false);
        return;
      }

      if (firebaseUser) {
        await verifyUserAndNavigate(firebaseUser);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotPasswordLoading(true);
    setForgotPasswordSuccess(false);

    try {
      const { error: resetError } = await resetPassword(forgotPasswordEmail);
      
      if (resetError) {
        setError(resetError || 'Failed to send password reset email. Please try again.');
        setForgotPasswordLoading(false);
        return;
      }

      setForgotPasswordSuccess(true);
      setError(null);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const verifyUserAndNavigate = async (firebaseUser: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const userData = await usersCollection.get(firebaseUser.uid);
      
      if (!userData) {
        setError('User account not found. Please contact administrator.');
        setIsLoading(false);
        return;
      }

      // Check if user is pending approval
      if (userData.status === 'Pending') {
        setError('Your account is pending approval. Please wait for super admin approval.');
        setIsLoading(false);
        await auth.signOut();
        return;
      }

      if (userData.status === 'Inactive') {
        setError('Your account has been deactivated. Please contact administrator.');
        setIsLoading(false);
        await auth.signOut();
        return;
      }

      // Auto-detect role from user account - no need for user to select

      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError('Failed to verify user account. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen w-full flex-row bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Left Side - Branding */}
        <div className="relative hidden w-0 flex-1 lg:block bg-gradient-to-br from-primary to-primary-hover overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1200')] bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/70 to-primary/50"></div>
          <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-white shadow-lg">
                <span className="material-symbols-outlined text-3xl font-black">sports_tennis</span>
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight">Play Time</span>
                <p className="text-xs text-white/80 font-medium">Admin Panel</p>
              </div>
            </div>
            <div className="max-w-md space-y-6">
              <div>
                <h1 className="text-4xl font-black mb-4 leading-tight">
                  Manage Your Sports Venues
                  <span className="block text-white/90 text-3xl mt-2">Like Never Before</span>
                </h1>
                <p className="text-lg text-white/90 leading-relaxed">
                  Complete control over bookings, memberships, staff, and finances. All in one powerful platform.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-3xl font-black mb-1">100+</div>
                  <div className="text-xs text-white/80 font-medium">Venues</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black mb-1">50K+</div>
                  <div className="text-xs text-white/80 font-medium">Bookings</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black mb-1">24/7</div>
                  <div className="text-xs text-white/80 font-medium">Support</div>
                </div>
              </div>
            </div>
            <div className="flex gap-6 text-xs font-bold text-white/70">
              <span>© 2024 Play Time</span>
              <a className="hover:text-white transition-colors" href="#">Privacy</a>
              <a className="hover:text-white transition-colors" href="#">Terms</a>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-white dark:bg-surface-dark w-full lg:w-[600px] shadow-2xl z-10">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                {mode === 'login' 
                  ? 'Sign in to manage your venues and bookings.' 
                  : 'Join Play Time and start managing your sports venue.'}
              </p>
            </div>

            {/* Email/Password Form - Primary Method */}
            {mode === 'login' && authMethod === 'email' && (
                  <form onSubmit={handleCredentialsSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Email address</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">mail</span>
                        </div>
                        <input 
                          className="block w-full rounded-2xl border-none py-4 pl-12 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-inner ring-1 ring-inset ring-gray-100 dark:ring-gray-700 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-gray-700 transition-all font-semibold" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email" 
                          required
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">lock</span>
                        </div>
                        <input 
                          className="block w-full rounded-2xl border-none py-4 pl-12 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-inner ring-1 ring-inset ring-gray-100 dark:ring-gray-700 focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-gray-700 transition-all font-semibold" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type="password" 
                          required 
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center">
                        <input className="h-5 w-5 rounded-lg border-gray-200 text-primary focus:ring-primary transition-all cursor-pointer" id="remember-me" type="checkbox" />
                        <label className="ml-3 block text-sm font-bold text-gray-600 dark:text-gray-400 cursor-pointer" htmlFor="remember-me">Remember me</label>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError(null);
                        }}
                        className="text-sm font-black text-primary hover:text-primary-hover uppercase tracking-widest text-[10px]"
                      >
                        Forgot?
                      </button>
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 justify-center text-red-500 bg-red-50 py-3 rounded-xl border border-red-100">
                        <span className="material-symbols-outlined text-lg">error</span>
                        <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                      </div>
                    )}
                    <button 
                      className="w-full flex justify-center rounded-2xl bg-primary py-4 text-xs font-black text-primary-content uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Signing in...
                        </>
                      ) : 'Sign In'}
                    </button>
                  </form>
            )}

            {/* Forgot Password Form */}
            {mode === 'login' && showForgotPassword && !forgotPasswordSuccess && (
              <div className="space-y-6">
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                    setError(null);
                  }}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors mb-4"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  <span className="font-bold">Back to Sign In</span>
                </button>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 mb-2">Reset Password</h3>
                  <p className="text-sm text-gray-500 font-medium mb-6">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">mail</span>
                      </div>
                      <input 
                        className="block w-full rounded-2xl border-none py-4 pl-12 bg-gray-50 text-gray-900 shadow-inner ring-1 ring-inset ring-gray-100 focus:ring-2 focus:ring-primary focus:bg-white transition-all font-semibold" 
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        type="email" 
                        required
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 justify-center text-red-500 bg-red-50 py-3 rounded-xl border border-red-100">
                      <span className="material-symbols-outlined text-lg">error</span>
                      <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                  <button 
                    className="w-full flex justify-center rounded-2xl bg-primary py-4 text-xs font-black text-primary-content uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                    type="submit"
                    disabled={forgotPasswordLoading}
                  >
                    {forgotPasswordLoading ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : 'Send Reset Link'}
                  </button>
                </form>
              </div>
            )}

            {/* Forgot Password Success */}
            {mode === 'login' && showForgotPassword && forgotPasswordSuccess && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">Check Your Email</h3>
                  <p className="text-sm text-gray-600 font-medium mb-6">
                    We've sent a password reset link to <strong>{forgotPasswordEmail}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mb-6">
                    Click the link in the email to reset your password. If you don't see it, check your spam folder.
                  </p>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordEmail('');
                      setForgotPasswordSuccess(false);
                      setError(null);
                    }}
                    className="w-full flex justify-center rounded-2xl bg-primary py-4 text-xs font-black text-primary-content uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {/* Alternative Sign-In Methods - Only show when not in forgot password mode */}
            {mode === 'login' && authMethod === 'email' && !showForgotPassword && (
              <div className="mt-6 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setAuthMethod('phone'); setOtpSent(false); setError(null); }}
                    className="flex items-center justify-center gap-2 rounded-xl py-3 px-4 border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-primary transition-all group"
                  >
                    <span className="material-symbols-outlined text-gray-600 group-hover:text-primary">phone</span>
                    <span className="text-sm font-bold text-gray-700 group-hover:text-primary">Phone</span>
                  </button>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 rounded-xl py-3 px-4 border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-primary transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-sm font-bold text-gray-700 group-hover:text-primary">Google</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sign Up Link - Only show when not in forgot password mode */}
            {mode === 'login' && !showForgotPassword && (
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 font-medium">
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setShowSignupModal(true);
                    }}
                    className="text-primary font-black hover:text-primary-hover transition-colors"
                  >
                    Sign up here
                  </button>
                </p>
              </div>
            )}

            {/* Phone OTP Form */}
            {mode === 'login' && authMethod === 'phone' && !otpSent && (
              <div className="space-y-6">
                <button
                  onClick={() => { setAuthMethod('email'); setError(null); }}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors mb-4"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  <span className="font-bold">Back to Email</span>
                </button>
                <form onSubmit={handlePhoneSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">phone</span>
                      </div>
                      <input 
                        className="block w-full rounded-2xl border-none py-4 pl-12 bg-gray-50 text-gray-900 shadow-inner ring-1 ring-inset ring-gray-100 focus:ring-2 focus:ring-primary focus:bg-white transition-all font-semibold" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        type="tel" 
                        placeholder="9876543210"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1">We'll send you a verification code</p>
                  </div>
                  <div id="recaptcha-container" ref={recaptchaContainerRef} className="flex justify-center"></div>
                  {error && (
                    <div className="flex items-center gap-2 justify-center text-red-500 bg-red-50 py-3 rounded-xl border border-red-100">
                      <span className="material-symbols-outlined text-lg">error</span>
                      <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                  <button 
                    className="w-full flex justify-center rounded-2xl bg-primary py-4 text-xs font-black text-primary-content uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                    type="submit"
                    disabled={isLoading || !recaptchaVerifier}
                  >
                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>
              </div>
            )}

            {/* OTP Verification Form */}
            {mode === 'login' && authMethod === 'phone' && otpSent && (
              <div className="space-y-6">
                <button
                  onClick={() => { setOtpSent(false); setOtpCode(''); setConfirmationResult(null); }}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors mb-4"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  <span className="font-bold">Change Phone Number</span>
                </button>
                <form onSubmit={handleOTPSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Enter OTP</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                      </div>
                      <input 
                        className="block w-full rounded-2xl border-none py-4 pl-12 bg-gray-50 text-gray-900 shadow-inner ring-1 ring-inset ring-gray-100 focus:ring-2 focus:ring-primary focus:bg-white transition-all font-semibold text-center text-2xl tracking-widest" 
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        type="text" 
                        placeholder="000000"
                        maxLength={6}
                        required
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1">Code sent to {phoneNumber}</p>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 justify-center text-red-500 bg-red-50 py-3 rounded-xl border border-red-100">
                      <span className="material-symbols-outlined text-lg">error</span>
                      <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                  <button 
                    className="w-full flex justify-center rounded-2xl bg-primary py-4 text-xs font-black text-primary-content uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                    type="submit"
                    disabled={isLoading || otpCode.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </form>
              </div>
            )}

            {/* Google Sign In Loading */}
            {mode === 'login' && authMethod === 'google' && isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="ml-3 text-sm font-semibold text-gray-600">Signing in with Google...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <VendorSignupModal
        isOpen={showSignupModal}
        onClose={() => {
          setShowSignupModal(false);
          setMode('login');
        }}
        onSuccess={() => {
          setShowSignupModal(false);
          setMode('login');
          setError(null);
        }}
      />
    </>
  );
};

export default Login;
