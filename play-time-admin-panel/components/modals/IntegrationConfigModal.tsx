import React, { useState, useEffect } from 'react';
import { IntegrationConfig } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';
import { getIntegrationHealth } from '../../services/trustedAdminApi';

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
  currentConfig: IntegrationConfig;
  onSave: (config: IntegrationConfig) => Promise<void>;
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
  const { showWarning, showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Initialize form with current config, but clear password fields for security
      const initialData = {
        ...currentConfig,
        ...(integration === 'whatsapp' && {
          apiKey: undefined,
          apiSecret: undefined,
          webhookSecret: undefined,
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
    if (integration === 'whatsapp') return;
    try {
      setSaving(true);
      setTestResult(null);
      
      // Merge with existing config - preserve existing values if new ones aren't provided
      // For password/secret fields, only update if a new value was entered
      // Firestore rejects undefined - use empty string for optional empty fields
      const mergedConfig: typeof formData = {
        ...currentConfig,
        ...formData,
        // Preserve existing secret values if new ones aren't provided
        apiKey: formData.apiKey || currentConfig.apiKey,
        apiSecret: undefined,
        webhookSecret: undefined,
      };
      
      // Validate required fields based on integration type
      if (!mergedConfig.apiKey) {
        showWarning('Please fill in all required fields');
        setSaving(false);
        return;
      }

      // Update status based on whether credentials are provided
      const updatedConfig: IntegrationConfig = {
        ...mergedConfig,
        status: mergedConfig.apiKey ? 'Unknown' : 'Setup Required'
      };

      await onSave(updatedConfig);
      onClose();
    } catch (error: any) {
      console.error('Error saving integration config:', error);
      showError('Failed to save configuration: ' + getFirebaseErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const health = await getIntegrationHealth(integration);
      setTestResult({
        success: health.healthy,
        message: health.message || (health.healthy
          ? 'Backend health check passed.'
          : health.configured
            ? 'Backend configuration is unhealthy.'
            : 'Integration is not configured on the server.'),
      });
    } catch (error: any) {
      setTestResult({ success: false, message: 'Connection test failed: ' + getFirebaseErrorMessage(error) });
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
          label: 'Key ID',
          type: 'text',
          placeholder: 'rzp_live_... or rzp_test_...',
          required: true,
          help: 'Public checkout Key ID only. Never enter an API or webhook secret here.'
        }
      ]
    },
    whatsapp: {
      title: 'WhatsApp Business API Health',
      description: 'WhatsApp credentials are configured only in trusted server-side secret storage.',
      fields: []
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
        <div className="p-4 sm:p-8 space-y-6">
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
          {integration === 'whatsapp' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Browser-based WhatsApp credentials are intentionally unsupported. Configure the provider
              secret and sender identifiers in the backend, deploy the trusted send and health endpoints,
              then use the health check below.
            </div>
          )}

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
                  Only the public Razorpay Key ID is stored in Firestore. API and webhook secrets
                  must be managed with server-side secret storage and never entered in this panel.
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
            {integration === 'razorpay' && <button
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
            </button>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationConfigModal;

