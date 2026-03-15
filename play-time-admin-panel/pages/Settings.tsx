import React, { useState, useRef } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useAuth } from '../contexts/AuthContext';
import { AppSettings } from '../types';
import IntegrationConfigModal from '../components/modals/IntegrationConfigModal';
import LandingPageManagementModal from '../components/modals/LandingPageManagementModal';
import { uploadFile } from '../services/firebase';
import { useToast } from '../contexts/ToastContext';

const Settings: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const { settings, loading, updateSettings } = useAppSettings(true);
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<'razorpay' | 'whatsapp' | null>(null);
  const [landingPageModalOpen, setLandingPageModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('general');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form state - initialize with all settings
  const [formData, setFormData] = useState<Partial<AppSettings>>({});

  // Update form data when settings load
  React.useEffect(() => {
    if (!loading && settings) {
      setFormData({
        // General
        appName: settings.appName,
        appLogo: settings.appLogo,
        appDescription: settings.appDescription,
        timezone: settings.timezone,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
        locale: settings.locale,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        // Business Rules
        convenienceFee: settings.convenienceFee,
        platformCommission: settings.platformCommission,
        cancellationWindowHours: settings.cancellationWindowHours,
        bookingBufferMinutes: settings.bookingBufferMinutes,
        // Booking Settings
        maxAdvanceBookingDays: settings.maxAdvanceBookingDays,
        minBookingDurationMinutes: settings.minBookingDurationMinutes,
        maxBookingDurationMinutes: settings.maxBookingDurationMinutes,
        autoConfirmBookings: settings.autoConfirmBookings,
        requireVenueApproval: settings.requireVenueApproval,
        allowSameDayBookings: settings.allowSameDayBookings,
        refundPolicy: settings.refundPolicy,
        refundPercentage: settings.refundPercentage,
        // Payment Settings
        paymentMethods: settings.paymentMethods,
        settlementFrequency: settings.settlementFrequency,
        minimumPayoutAmount: settings.minimumPayoutAmount,
        enableAutoSettlement: settings.enableAutoSettlement,
        taxRate: settings.taxRate,
        enableGST: settings.enableGST,
        gstNumber: settings.gstNumber,
        // Notification Settings
        defaultNotificationChannels: settings.defaultNotificationChannels,
        enableBookingNotifications: settings.enableBookingNotifications,
        enablePaymentNotifications: settings.enablePaymentNotifications,
        enableMarketingNotifications: settings.enableMarketingNotifications,
        notificationReminderHours: settings.notificationReminderHours,
        enableAutoReminders: settings.enableAutoReminders,
        // Security Settings
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        requireStrongPasswords: settings.requireStrongPasswords,
        minPasswordLength: settings.minPasswordLength,
        enableTwoFactorAuth: settings.enableTwoFactorAuth,
        apiRateLimit: settings.apiRateLimit,
        enableMaintenanceMode: settings.enableMaintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        // System Settings
        dataRetentionDays: settings.dataRetentionDays,
        enableAutoBackup: settings.enableAutoBackup,
        backupFrequency: settings.backupFrequency,
        enableAnalytics: settings.enableAnalytics,
        enableErrorLogging: settings.enableErrorLogging,
        maxFileUploadSizeMB: settings.maxFileUploadSizeMB,
        // Integrations
        integrations: settings.integrations
      });
    }
  }, [settings, loading]);

  const handleSave = async () => {
    if (!isSuperAdmin) {
      alert('Only super admins can update settings');
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(false);
      
      await updateSettings(formData);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleIntegrationToggle = async (integration: 'razorpay' | 'whatsapp', enabled: boolean) => {
    if (!isSuperAdmin) {
      alert('Only super admins can modify integrations');
      return;
    }

    const currentIntegration = formData.integrations?.[integration];
    const hasCredentials = integration === 'razorpay' 
      ? !!(currentIntegration?.apiKey && currentIntegration?.apiSecret)
      : !!(currentIntegration?.apiKey && currentIntegration?.phoneNumberId && currentIntegration?.businessAccountId);

    if (enabled && !hasCredentials) {
      alert('Please configure the integration first before enabling it.');
      return;
    }

    const updatedFormData = {
      ...formData,
      integrations: {
        ...formData.integrations!,
        [integration]: {
          ...formData.integrations![integration],
          enabled,
          status: enabled && hasCredentials ? 'Connected' : enabled ? 'Disconnected' : 'Disconnected'
        }
      }
    };

    setFormData(updatedFormData);
    
    // Auto-save when toggling
    try {
      await updateSettings(updatedFormData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error: any) {
      console.error('Error updating integration:', error);
      alert('Failed to update integration: ' + error.message);
      // Revert on error
      setFormData(prev => ({
        ...prev,
        integrations: {
          ...prev.integrations!,
          [integration]: currentIntegration!
        }
      }));
    }
  };

  const handleIntegrationConfigure = (integration: 'razorpay' | 'whatsapp') => {
    setSelectedIntegration(integration);
    setConfigModalOpen(true);
  };

  const handleSaveIntegrationConfig = async (config: AppSettings['integrations'][keyof AppSettings['integrations']]) => {
    if (!selectedIntegration) return;

    // Determine if credentials are complete
    let hasCredentials = false;
    if (selectedIntegration === 'razorpay') {
      hasCredentials = !!(config.apiKey && config.apiSecret);
    } else if (selectedIntegration === 'whatsapp') {
      hasCredentials = !!(config.apiKey && config.phoneNumberId && config.businessAccountId);
    }

    // Update status based on credentials and enabled state
    const updatedConfig = {
      ...config,
      status: hasCredentials 
        ? (config.enabled ? 'Connected' : 'Disconnected')
        : 'Setup Required'
    } as AppSettings['integrations'][typeof selectedIntegration];

    const updatedFormData = {
      ...formData,
      integrations: {
        ...formData.integrations!,
        [selectedIntegration]: updatedConfig
      }
    };

    setFormData(updatedFormData);
    await updateSettings(updatedFormData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const updateFormField = (field: keyof AppSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleFormField = (field: keyof AppSettings) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingLogo(true);
      const path = `app-settings/logo/${Date.now()}_${file.name}`;
      const url = await uploadFile(path, file, { contentType: file.type });
      updateFormField('appLogo', url);
      showSuccess('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      showError('Failed to upload logo: ' + error.message);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handlePaymentMethodToggle = (method: string) => {
    const currentMethods = formData.paymentMethods || [];
    const updatedMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method];
    updateFormField('paymentMethods', updatedMethods);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'business', label: 'Business Rules', icon: 'rule' },
    { id: 'booking', label: 'Booking', icon: 'event' },
    { id: 'payment', label: 'Payment', icon: 'payments' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'security', label: 'Security', icon: 'security' },
    { id: 'system', label: 'System', icon: 'computer' },
    { id: 'integrations', label: 'Integrations', icon: 'hub' },
    { id: 'landing', label: 'Landing Page', icon: 'home' }
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings</span> General Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">App Name</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold opacity-60 cursor-not-allowed"
                  type="text"
                  value={formData.appName || ''}
                  readOnly
                  disabled
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">App Logo</label>
                <div className="flex items-center gap-4">
                  {formData.appLogo && (
                    <img 
                      src={formData.appLogo} 
                      alt="App Logo" 
                      className="w-16 h-16 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark p-2"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={!isSuperAdmin || uploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className={`inline-flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        (!isSuperAdmin || uploadingLogo) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingLogo ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">upload</span>
                          {formData.appLogo ? 'Change Logo' : 'Upload Logo'}
                        </>
                      )}
                    </label>
                  </div>
                </div>
                <p className="text-[9px] text-gray-400 font-medium italic">Recommended: 512x512px, max 5MB</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">App Description</label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary resize-none"
                  rows={3}
                  value={formData.appDescription || ''}
                  onChange={(e) => updateFormField('appDescription', e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Timezone</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.timezone || 'Asia/Kolkata'}
                  onChange={(e) => updateFormField('timezone', e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Locale</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.locale || 'en-IN'}
                  onChange={(e) => updateFormField('locale', e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="hi-IN">Hindi (India)</option>
                  <option value="ar-AE">Arabic (UAE)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Currency</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="text"
                  value={formData.currency || 'INR'}
                  onChange={(e) => updateFormField('currency', e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Currency Symbol</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="text"
                  value={formData.currencySymbol || '₹'}
                  onChange={(e) => updateFormField('currencySymbol', e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Support Email</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="email"
                  value={formData.supportEmail || ''}
                  onChange={(e) => updateFormField('supportEmail', e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Support Phone</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="tel"
                  value={formData.supportPhone || ''}
                  onChange={(e) => updateFormField('supportPhone', e.target.value)}
                  disabled={!isSuperAdmin}
                />
              </div>
            </div>
          </section>
        );

      case 'business':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">rule</span> Business Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Platform Convenience Fee (₹)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.convenienceFee || 0}
                  onChange={(e) => updateFormField('convenienceFee', parseFloat(e.target.value) || 0)}
                  disabled={!isSuperAdmin}
                />
                <p className="text-[9px] text-gray-400 font-medium italic">Charged on the very first booking per player.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Platform Commission (%)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.platformCommission || 0}
                  onChange={(e) => updateFormField('platformCommission', parseFloat(e.target.value) || 0)}
                  disabled={!isSuperAdmin}
                />
                <p className="text-[9px] text-gray-400 font-medium italic">Commission on membership purchases.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cancellation Window (Hours)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.cancellationWindowHours || 0}
                  onChange={(e) => updateFormField('cancellationWindowHours', parseFloat(e.target.value) || 0)}
                  disabled={!isSuperAdmin}
                />
                <p className="text-[9px] text-gray-400 font-medium italic">Hours before booking that cancellation is allowed.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Booking Buffer (Minutes)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.bookingBufferMinutes || 0}
                  onChange={(e) => updateFormField('bookingBufferMinutes', parseFloat(e.target.value) || 0)}
                  disabled={!isSuperAdmin}
                />
                <p className="text-[9px] text-gray-400 font-medium italic">Minutes between consecutive bookings.</p>
              </div>
            </div>
          </section>
        );

      case 'booking':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">event</span> Booking Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Max Advance Booking Days</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="1"
                  value={formData.maxAdvanceBookingDays || 30}
                  onChange={(e) => updateFormField('maxAdvanceBookingDays', parseInt(e.target.value) || 30)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min Booking Duration (Minutes)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="15"
                  step="15"
                  value={formData.minBookingDurationMinutes || 30}
                  onChange={(e) => updateFormField('minBookingDurationMinutes', parseInt(e.target.value) || 30)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Max Booking Duration (Minutes)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="30"
                  step="30"
                  value={formData.maxBookingDurationMinutes || 480}
                  onChange={(e) => updateFormField('maxBookingDurationMinutes', parseInt(e.target.value) || 480)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Refund Policy</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.refundPolicy || 'partial'}
                  onChange={(e) => updateFormField('refundPolicy', e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="full">Full Refund</option>
                  <option value="partial">Partial Refund</option>
                  <option value="none">No Refund</option>
                </select>
              </div>
              {formData.refundPolicy === 'partial' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Refund Percentage (%)</label>
                  <input
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.refundPercentage || 50}
                    onChange={(e) => updateFormField('refundPercentage', parseInt(e.target.value) || 50)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Auto-Confirm Bookings</label>
                  <p className="text-xs text-gray-500">Automatically confirm bookings without approval</p>
                </div>
                <button
                  onClick={() => toggleFormField('autoConfirmBookings')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.autoConfirmBookings ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.autoConfirmBookings ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Require Venue Approval</label>
                  <p className="text-xs text-gray-500">Require venue manager approval for bookings</p>
                </div>
                <button
                  onClick={() => toggleFormField('requireVenueApproval')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.requireVenueApproval ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.requireVenueApproval ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Allow Same Day Bookings</label>
                  <p className="text-xs text-gray-500">Allow bookings to be made on the same day</p>
                </div>
                <button
                  onClick={() => toggleFormField('allowSameDayBookings')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.allowSameDayBookings ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.allowSameDayBookings ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </section>
        );

      case 'payment':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">payments</span> Payment Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Methods</label>
                <div className="flex flex-wrap gap-3">
                  {['razorpay', 'stripe', 'paypal', 'cash', 'bank_transfer'].map((method) => (
                    <label
                      key={method}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all ${
                        (formData.paymentMethods || []).includes(method)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={(formData.paymentMethods || []).includes(method)}
                        onChange={() => handlePaymentMethodToggle(method)}
                        disabled={!isSuperAdmin}
                        className="sr-only"
                      />
                      <span className="text-sm font-bold capitalize">{method.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[9px] text-gray-400 font-medium italic">Select available payment methods for users</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Settlement Frequency</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.settlementFrequency || 'weekly'}
                  onChange={(e) => updateFormField('settlementFrequency', e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Minimum Payout Amount (₹)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="0"
                  value={formData.minimumPayoutAmount || 1000}
                  onChange={(e) => updateFormField('minimumPayoutAmount', parseFloat(e.target.value) || 1000)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax Rate (%)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.taxRate || 0}
                  onChange={(e) => updateFormField('taxRate', parseFloat(e.target.value) || 0)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Enable GST</label>
                  <p className="text-xs text-gray-500">Enable GST for transactions</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableGST')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableGST ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableGST ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {formData.enableGST && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GST Number</label>
                  <input
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                    type="text"
                    value={formData.gstNumber || ''}
                    onChange={(e) => updateFormField('gstNumber', e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Auto Settlement</label>
                  <p className="text-xs text-gray-500">Automatically process settlements</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableAutoSettlement')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableAutoSettlement ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableAutoSettlement ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </section>
        );

      case 'notifications':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">notifications</span> Notification Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Booking Notifications</label>
                  <p className="text-xs text-gray-500">Send notifications for booking events</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableBookingNotifications')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableBookingNotifications ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableBookingNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Payment Notifications</label>
                  <p className="text-xs text-gray-500">Send notifications for payment events</p>
                </div>
                <button
                  onClick={() => toggleFormField('enablePaymentNotifications')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enablePaymentNotifications ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enablePaymentNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Marketing Notifications</label>
                  <p className="text-xs text-gray-500">Allow marketing and promotional notifications</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableMarketingNotifications')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableMarketingNotifications ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableMarketingNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Auto Reminders</label>
                  <p className="text-xs text-gray-500">Automatically send booking reminders</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableAutoReminders')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableAutoReminders ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableAutoReminders ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reminder Hours (comma-separated)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="text"
                  placeholder="24, 2"
                  value={formData.notificationReminderHours?.join(', ') || ''}
                  onChange={(e) => {
                    const hours = e.target.value.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h));
                    updateFormField('notificationReminderHours', hours);
                  }}
                  disabled={!isSuperAdmin}
                />
                <p className="text-[9px] text-gray-400 font-medium italic">Hours before booking to send reminder (e.g., 24, 2)</p>
              </div>
            </div>
          </section>
        );

      case 'security':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">security</span> Security Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Session Timeout (Minutes)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="15"
                  value={formData.sessionTimeoutMinutes || 480}
                  onChange={(e) => updateFormField('sessionTimeoutMinutes', parseInt(e.target.value) || 480)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min Password Length</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="6"
                  max="32"
                  value={formData.minPasswordLength || 8}
                  onChange={(e) => updateFormField('minPasswordLength', parseInt(e.target.value) || 8)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">API Rate Limit (per minute)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="10"
                  value={formData.apiRateLimit || 100}
                  onChange={(e) => updateFormField('apiRateLimit', parseInt(e.target.value) || 100)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Require Strong Passwords</label>
                  <p className="text-xs text-gray-500">Enforce strong password requirements</p>
                </div>
                <button
                  onClick={() => toggleFormField('requireStrongPasswords')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.requireStrongPasswords ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.requireStrongPasswords ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Two-Factor Authentication</label>
                  <p className="text-xs text-gray-500">Enable 2FA for admin accounts</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableTwoFactorAuth')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableTwoFactorAuth ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableTwoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Maintenance Mode</label>
                  <p className="text-xs text-gray-500">Enable maintenance mode</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableMaintenanceMode')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableMaintenanceMode ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableMaintenanceMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {formData.enableMaintenanceMode && (
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Maintenance Message</label>
                  <textarea
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                    rows={3}
                    value={formData.maintenanceMessage || ''}
                    onChange={(e) => updateFormField('maintenanceMessage', e.target.value)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              )}
            </div>
          </section>
        );

      case 'system':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">computer</span> System Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Retention (Days)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="30"
                  value={formData.dataRetentionDays || 365}
                  onChange={(e) => updateFormField('dataRetentionDays', parseInt(e.target.value) || 365)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Max File Upload Size (MB)</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxFileUploadSizeMB || 10}
                  onChange={(e) => updateFormField('maxFileUploadSizeMB', parseInt(e.target.value) || 10)}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Backup Frequency</label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm font-bold focus:ring-primary focus:border-primary"
                  value={formData.backupFrequency || 'daily'}
                  onChange={(e) => updateFormField('backupFrequency', e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Auto Backup</label>
                  <p className="text-xs text-gray-500">Enable automatic backups</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableAutoBackup')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableAutoBackup ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableAutoBackup ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Analytics</label>
                  <p className="text-xs text-gray-500">Enable analytics tracking</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableAnalytics')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableAnalytics ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableAnalytics ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="text-sm font-bold text-gray-700">Error Logging</label>
                  <p className="text-xs text-gray-500">Enable error logging</p>
                </div>
                <button
                  onClick={() => toggleFormField('enableErrorLogging')}
                  disabled={!isSuperAdmin}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.enableErrorLogging ? 'bg-primary' : 'bg-gray-300'
                  } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enableErrorLogging ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </section>
        );

      case 'landing':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">home</span> Landing Page Management
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 font-medium">
                Manage the content displayed on your landing page. Edit hero section, features, stats, and more.
              </p>
              <button
                onClick={() => setLandingPageModalOpen(true)}
                className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                Manage Landing Page
              </button>
            </div>
          </section>
        );

      case 'integrations':
        return (
          <section className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">hub</span> Integrations & API
            </h3>
            <div className="space-y-4">
              {[
                { 
                  key: 'razorpay' as const, 
                  name: 'Razorpay Gateway', 
                  icon: 'payments',
                  status: formData.integrations?.razorpay?.status || 'Setup Required'
                },
                { 
                  key: 'whatsapp' as const, 
                  name: 'WhatsApp API', 
                  icon: 'chat',
                  status: formData.integrations?.whatsapp?.status || 'Setup Required'
                },
              ].map((api) => {
                const integration = formData.integrations?.[api.key];
                const isEnabled = integration?.enabled || false;
                
                // Determine status based on configuration
                const hasCredentials = api.key === 'razorpay' 
                  ? !!(integration?.apiKey && integration?.apiSecret)
                  : !!(integration?.apiKey && integration?.phoneNumberId && integration?.businessAccountId);
                
                const status = isEnabled && hasCredentials 
                  ? 'Connected' 
                  : hasCredentials && !isEnabled
                  ? 'Disconnected'
                  : 'Setup Required';
                
                return (
                  <div key={api.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-primary">
                        <span className="material-symbols-outlined">{api.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-700">{api.name}</span>
                          {status === 'Connected' && (
                            <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                          )}
                        </div>
                        {isEnabled && hasCredentials && (
                          <p className="text-xs text-gray-500 mt-1">Integration active and connected</p>
                        )}
                        {hasCredentials && !isEnabled && (
                          <p className="text-xs text-gray-500 mt-1">Configured but disabled</p>
                        )}
                        {!hasCredentials && (
                          <p className="text-xs text-amber-600 mt-1">Configuration required</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        status === 'Connected' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : status === 'Disconnected'
                          ? 'bg-gray-50 text-gray-500 border-gray-200'
                          : 'bg-orange-50 text-orange-600 border-orange-200'
                      }`}>
                        {status}
                      </span>
                      {isSuperAdmin && (
                        <>
                          {hasCredentials && (
                            <button
                              onClick={() => handleIntegrationToggle(api.key, !isEnabled)}
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                                isEnabled
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                              }`}
                            >
                              {isEnabled ? 'Disable' : 'Enable'}
                            </button>
                          )}
                          <button
                            onClick={() => handleIntegrationConfigure(api.key)}
                            className="px-4 py-1.5 bg-primary text-primary-content rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-sm"
                          >
                            Configure
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-6 bg-background-light dark:bg-background-dark min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Settings</h2>
          <p className="text-gray-500 mt-1 font-medium">Configure platform settings, business rules, and integrations.</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      activeSection === section.id
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{section.icon}</span>
                    <span>{section.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {renderSection()}

            {isSuperAdmin && (
              <div className="flex justify-between items-center pt-6 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    <span className="text-sm font-bold">Settings saved successfully!</span>
                  </div>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-sidebar-dark text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">save</span>
                        Save All Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {!isSuperAdmin && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm text-amber-800 font-medium">
                  <span className="material-symbols-outlined text-lg align-middle mr-2">info</span>
                  Only super admins can modify platform settings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Integration Configuration Modal */}
      {selectedIntegration && (
        <IntegrationConfigModal
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedIntegration(null);
          }}
          integration={selectedIntegration}
          currentConfig={formData.integrations?.[selectedIntegration] || {
            enabled: false,
            status: 'Setup Required'
          } as AppSettings['integrations'][typeof selectedIntegration]}
          onSave={handleSaveIntegrationConfig}
        />
      )}

      {/* Landing Page Management Modal */}
      <LandingPageManagementModal
        isOpen={landingPageModalOpen}
        onClose={() => setLandingPageModalOpen(false)}
      />
    </div>
  );
};

export default Settings;
