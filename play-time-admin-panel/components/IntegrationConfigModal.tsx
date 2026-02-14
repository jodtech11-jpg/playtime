import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';

// Password Input Component with visibility toggle
const PasswordInput: React.FC<{
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ value, placeholder, onChange }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary focus:border-primary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">
          {showPassword ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
};

interface IntegrationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: 'razorpay' | 'whatsapp';
  currentConfig: AppSettings['integrations'][keyof AppSettings['integrations']];
  onSave: (config: AppSettings['integrations'][keyof AppSettings['integrations']]) => Promise<void>;
}

const IntegrationConfigModal: React.FC<IntegrationConfigModalProps> = ({
  isOpen,
  onClose,
  integration,
  currentConfig,
  onSave
}) => {
  const [formData, setFormData] = useState(currentConfig);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Initialize form with current config, but clear password fields for security
      const initialData = {
        ...currentConfig,
        // Clear password/secret fields so user must re-enter (or we'll preserve existing)
        ...(integration === 'razorpay' && {
          apiSecret: '',
          webhookSecret: currentConfig.webhookSecret ? '' : undefined
        }),
        ...(integration === 'whatsapp' && {
          apiKey: ''
        })
      };
      setFormData(initialData);
      setTestResult(null);
    }
  }, [isOpen, currentConfig, integration]);

  // Helper to mask sensitive values for display
  const maskValue = (value: string | undefined): string => {
    if (!value) return '';
    if (value.length <= 8) return '••••••••';
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setTestResult(null);
      
      // Merge with existing config - preserve existing values if new ones aren't provided
      // For password/secret fields, only update if a new value was entered
      const mergedConfig: typeof formData = {
        ...currentConfig,
        ...formData,
        // Preserve existing secret values if new ones aren't provided
        ...(integration === 'razorpay' && {
          apiKey: formData.apiKey || currentConfig.apiKey,
          apiSecret: formData.apiSecret || currentConfig.apiSecret,
          webhookSecret: formData.webhookSecret !== undefined 
            ? (formData.webhookSecret || currentConfig.webhookSecret)
            : currentConfig.webhookSecret
        }),
        ...(integration === 'whatsapp' && {
          apiKey: formData.apiKey || currentConfig.apiKey,
          phoneNumberId: formData.phoneNumberId || currentConfig.phoneNumberId,
          businessAccountId: formData.businessAccountId || currentConfig.businessAccountId
        })
      };
      
      // Validate required fields based on integration type
      if (integration === 'razorpay') {
        if (!mergedConfig.apiKey || !mergedConfig.apiSecret) {
          alert('Please fill in all required fields');
          return;
        }
      } else if (integration === 'whatsapp') {
        if (!mergedConfig.apiKey || !mergedConfig.phoneNumberId || !mergedConfig.businessAccountId) {
          alert('Please fill in all required fields');
          return;
        }
      }

      // Update status based on whether credentials are provided
      const updatedConfig = {
        ...mergedConfig,
        status: (mergedConfig.apiKey || mergedConfig.accountSid) 
          ? (mergedConfig.enabled ? 'Connected' : 'Disconnected')
          : 'Setup Required' as const
      };

      await onSave(updatedConfig);
      onClose();
    } catch (error: any) {
      console.error('Error saving integration config:', error);
      alert('Failed to save configuration: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Simulate connection test (in production, this would make actual API calls)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Basic validation
      let isValid = false;
      if (integration === 'razorpay') {
        isValid = !!(formData.apiKey && formData.apiSecret);
      } else if (integration === 'whatsapp') {
        isValid = !!(formData.apiKey && formData.phoneNumberId && formData.businessAccountId);
      }

      if (isValid) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: 'Please fill in all required fields' });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: 'Connection test failed: ' + error.message });
    } finally {
      setTesting(false);
    }
  };

  const integrationConfig = {
    razorpay: {
      title: 'Razorpay Gateway Configuration',
      description: 'Configure Razorpay payment gateway for processing bookings and memberships.',
      fields: [
        {
          key: 'apiKey' as const,
          label: 'API Key',
          type: 'text',
          placeholder: 'rzp_live_... or rzp_test_...',
          required: true,
          help: 'Your Razorpay API Key from the dashboard'
        },
        {
          key: 'apiSecret' as const,
          label: 'API Secret',
          type: 'password',
          placeholder: 'Enter API Secret',
          required: true,
          help: 'Your Razorpay API Secret (keep this secure)'
        },
        {
          key: 'webhookSecret' as const,
          label: 'Webhook Secret (Optional)',
          type: 'password',
          placeholder: 'Enter Webhook Secret',
          required: false,
          help: 'Webhook secret for verifying payment callbacks'
        }
      ]
    },
    whatsapp: {
      title: 'WhatsApp Business API Configuration',
      description: 'Configure WhatsApp Business API for sending notifications and messages.',
      fields: [
        {
          key: 'apiKey' as const,
          label: 'API Key / Access Token',
          type: 'password',
          placeholder: 'Enter API Key',
          required: true,
          help: 'Your WhatsApp Business API access token'
        },
        {
          key: 'phoneNumberId' as const,
          label: 'Phone Number ID',
          type: 'text',
          placeholder: 'Enter Phone Number ID',
          required: true,
          help: 'Your WhatsApp Business phone number ID'
        },
        {
          key: 'businessAccountId' as const,
          label: 'Business Account ID',
          type: 'text',
          placeholder: 'Enter Business Account ID',
          required: true,
          help: 'Your WhatsApp Business Account ID'
        }
      ]
    }
  };

  const config = integrationConfig[integration];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-gray-900">{config.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{config.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'password' ? (
                <div className="space-y-2">
                  {currentConfig[field.key] && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span>Current: {maskValue(currentConfig[field.key])}</span>
                    </div>
                  )}
                  <PasswordInput
                    value={formData[field.key] || ''}
                    placeholder={currentConfig[field.key] ? 'Enter new value (leave empty to keep current)' : field.placeholder}
                    onChange={(value) => setFormData(prev => ({ ...prev, [field.key]: value }))}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {currentConfig[field.key] && field.type === 'text' && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span>Current: {currentConfig[field.key]}</span>
                    </div>
                  )}
                  <input
                    type={field.type}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              )}
              {field.help && (
                <p className="text-[9px] text-gray-400 font-medium italic">{field.help}</p>
              )}
            </div>
          ))}

          {/* Test Connection Result */}
          {testResult && (
            <div className={`p-4 rounded-xl border ${
              testResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined ${
                  testResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <p className={`text-sm font-bold ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 text-lg">security</span>
              <div>
                <p className="text-xs font-black text-amber-900 uppercase tracking-widest mb-1">Security Notice</p>
                <p className="text-xs text-amber-800">
                  API credentials are stored securely in Firestore. Only super admins can view and modify these settings.
                  Never share your API keys or secrets with unauthorized personnel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 flex items-center justify-between gap-4">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testing ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                Testing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">wifi_protected_setup</span>
                Test Connection
              </>
            )}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">save</span>
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationConfigModal;

