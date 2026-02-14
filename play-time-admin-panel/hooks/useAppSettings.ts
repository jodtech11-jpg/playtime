import { useState, useEffect } from 'react';
import { appSettingsCollection } from '../services/firebase';
import { AppSettings } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_SETTINGS: AppSettings = {
  id: 'platform',
  // General Settings
  appName: 'Play Time',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
  supportEmail: 'support@playtime.com',
  supportPhone: '',
  // Business Rules
  convenienceFee: 100,
  platformCommission: 5,
  cancellationWindowHours: 12,
  bookingBufferMinutes: 15,
  // Booking Settings
  maxAdvanceBookingDays: 30,
  minBookingDurationMinutes: 30,
  maxBookingDurationMinutes: 480,
  autoConfirmBookings: false,
  requireVenueApproval: false,
  allowSameDayBookings: true,
  refundPolicy: 'partial',
  refundPercentage: 50,
  // Payment Settings
  paymentMethods: ['razorpay'],
  settlementFrequency: 'weekly',
  minimumPayoutAmount: 1000,
  enableAutoSettlement: false,
  taxRate: 0,
  enableGST: false,
  gstNumber: '',
  // Notification Settings
  defaultNotificationChannels: ['push'],
  enableBookingNotifications: true,
  enablePaymentNotifications: true,
  enableMarketingNotifications: true,
  notificationReminderHours: [24, 2],
  enableAutoReminders: true,
  // Security Settings
  sessionTimeoutMinutes: 480,
  requireStrongPasswords: true,
  minPasswordLength: 8,
  enableTwoFactorAuth: false,
  apiRateLimit: 100,
  enableMaintenanceMode: false,
  maintenanceMessage: 'We are currently performing maintenance. Please check back soon.',
  // System Settings
  dataRetentionDays: 365,
  enableAutoBackup: true,
  backupFrequency: 'daily',
  enableAnalytics: true,
  enableErrorLogging: true,
  maxFileUploadSizeMB: 10,
  // API Integrations
  integrations: {
    razorpay: {
      enabled: false,
      status: 'Setup Required'
    },
    whatsapp: {
      enabled: false,
      status: 'Setup Required'
    }
  }
};

export const useAppSettings = (realtime: boolean = true) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        if (realtime) {
          unsubscribe = appSettingsCollection.subscribe((data: AppSettings | null) => {
            if (data) {
              setSettings(data);
            } else {
              // If settings don't exist, use defaults
              setSettings(DEFAULT_SETTINGS);
            }
            setLoading(false);
          });
        } else {
          const data = await appSettingsCollection.get() as AppSettings | null;
          if (data) {
            setSettings(data);
          } else {
            setSettings(DEFAULT_SETTINGS);
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching app settings:', err);
        setError(err.message || 'Failed to fetch app settings');
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      }
    };

    fetchSettings();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [realtime]);

  const updateSettings = async (updates: Partial<AppSettings>) => {
    try {
      const currentSettings = await appSettingsCollection.get() as AppSettings | null;
      
      if (currentSettings) {
        // Update existing settings
        await appSettingsCollection.update({
          ...updates,
          updatedBy: user?.id,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create settings if they don't exist
        await appSettingsCollection.create({
          ...DEFAULT_SETTINGS,
          ...updates,
          updatedBy: user?.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error('Error updating app settings:', err);
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings
  };
};

