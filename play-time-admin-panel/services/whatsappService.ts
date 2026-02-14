/**
 * WhatsApp Service
 * Handles WhatsApp Business API integration for sending notifications
 */

import { usersCollection } from './firebase';
import { User } from '../types';

export interface WhatsAppMessage {
  to: string; // Phone number in E.164 format (e.g., +919876543210)
  message: string;
  template?: string; // Template name if using template messages
  templateParams?: string[]; // Template parameters
  mediaUrl?: string; // URL for media (image, document, etc.)
  mediaType?: 'image' | 'document' | 'video' | 'audio';
}

export interface WhatsAppConfig {
  apiKey: string;
  phoneNumberId: string;
  businessAccountId: string;
  provider?: 'whatsapp_business' | 'twilio' | 'messagebird' | 'custom';
  apiUrl?: string; // Custom API URL for custom provider
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send WhatsApp message using WhatsApp Business API
 * Supports multiple providers: WhatsApp Business API, Twilio, MessageBird, or custom backend
 */
export const sendWhatsAppMessage = async (
  message: WhatsAppMessage,
  config: WhatsAppConfig
): Promise<WhatsAppSendResult> => {
  try {
    const provider = config.provider || 'whatsapp_business';

    switch (provider) {
      case 'whatsapp_business':
        return await sendViaWhatsAppBusinessAPI(message, config);
      case 'twilio':
        return await sendViaTwilio(message, config);
      case 'messagebird':
        return await sendViaMessageBird(message, config);
      case 'custom':
        return await sendViaCustomAPI(message, config);
      default:
        throw new Error(`Unsupported WhatsApp provider: ${provider}`);
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message'
    };
  }
};

/**
 * Send message via WhatsApp Business API (official)
 */
const sendViaWhatsAppBusinessAPI = async (
  message: WhatsAppMessage,
  config: WhatsAppConfig
): Promise<WhatsAppSendResult> => {
  try {
    const apiUrl = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
    
    const payload: any = {
      messaging_product: 'whatsapp',
      to: message.to,
    };

    if (message.template) {
      // Template message
      payload.type = 'template';
      payload.template = {
        name: message.template,
        language: { code: 'en' },
        components: message.templateParams ? [{
          type: 'body',
          parameters: message.templateParams.map(param => ({
            type: 'text',
            text: param
          }))
        }] : undefined
      };
    } else if (message.mediaUrl) {
      // Media message
      payload.type = message.mediaType || 'image';
      payload[message.mediaType || 'image'] = {
        link: message.mediaUrl
      };
    } else {
      // Text message
      payload.type = 'text';
      payload.text = {
        body: message.message
      };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.messages?.[0]?.id
    };
  } catch (error: any) {
    console.error('WhatsApp Business API error:', error);
    throw error;
  }
};

/**
 * Send message via Twilio WhatsApp API
 */
const sendViaTwilio = async (
  message: WhatsAppMessage,
  config: WhatsAppConfig
): Promise<WhatsAppSendResult> => {
  try {
    // Twilio uses different format
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.businessAccountId}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${config.phoneNumberId}`);
    formData.append('To', `whatsapp:${message.to}`);
    formData.append('Body', message.message);

    if (message.mediaUrl) {
      formData.append('MediaUrl', message.mediaUrl);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${config.businessAccountId}:${config.apiKey}`)}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.sid
    };
  } catch (error: any) {
    console.error('Twilio WhatsApp API error:', error);
    throw error;
  }
};

/**
 * Send message via MessageBird WhatsApp API
 */
const sendViaMessageBird = async (
  message: WhatsAppMessage,
  config: WhatsAppConfig
): Promise<WhatsAppSendResult> => {
  try {
    const apiUrl = 'https://conversations.messagebird.com/v1/send';
    
    const payload = {
      to: message.to,
      from: config.phoneNumberId,
      type: message.mediaUrl ? (message.mediaType || 'image') : 'text',
      content: {
        text: message.message,
        ...(message.mediaUrl && {
          [message.mediaType || 'image']: {
            url: message.mediaUrl
          }
        })
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `AccessKey ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0]?.description || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id
    };
  } catch (error: any) {
    console.error('MessageBird WhatsApp API error:', error);
    throw error;
  }
};

/**
 * Send message via custom backend API
 */
const sendViaCustomAPI = async (
  message: WhatsAppMessage,
  config: WhatsAppConfig
): Promise<WhatsAppSendResult> => {
  if (!config.apiUrl) {
    throw new Error('Custom API URL not provided');
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        to: message.to,
        message: message.message,
        template: message.template,
        templateParams: message.templateParams,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.messageId || result.id
    };
  } catch (error: any) {
    console.error('Custom WhatsApp API error:', error);
    throw error;
  }
};

/**
 * Get phone numbers for target users
 */
export const getTargetPhoneNumbers = async (
  targetUserIds: string[]
): Promise<string[]> => {
  try {
    if (targetUserIds.length === 0) {
      return [];
    }

    const users = await usersCollection.getAll([
      ['id', 'in', targetUserIds]
    ]);

    const phoneNumbers: string[] = [];
    
    users.forEach((user: User) => {
      if (user.phone) {
        // Normalize phone number to E.164 format
        let phone = user.phone.trim();
        
        // Remove any non-digit characters except +
        phone = phone.replace(/[^\d+]/g, '');
        
        // Add country code if missing (assuming India +91)
        if (!phone.startsWith('+')) {
          if (phone.startsWith('0')) {
            phone = '+91' + phone.substring(1);
          } else if (phone.length === 10) {
            phone = '+91' + phone;
          } else {
            phone = '+91' + phone;
          }
        }
        
        phoneNumbers.push(phone);
      }
    });

    return Array.from(new Set(phoneNumbers)); // Remove duplicates
  } catch (error: any) {
    console.error('Error getting phone numbers:', error);
    throw error;
  }
};

/**
 * Format phone number to E.164 format
 */
export const formatPhoneNumber = (phone: string, countryCode: string = '+91'): string => {
  // Remove any non-digit characters except +
  let formatted = phone.replace(/[^\d+]/g, '');
  
  // Add country code if missing
  if (!formatted.startsWith('+')) {
    if (formatted.startsWith('0')) {
      formatted = countryCode + formatted.substring(1);
    } else if (formatted.length === 10) {
      formatted = countryCode + formatted;
    } else {
      formatted = countryCode + formatted;
    }
  }
  
  return formatted;
};

/**
 * Send WhatsApp notification to multiple users
 */
export const sendWhatsAppNotification = async (
  message: string,
  phoneNumbers: string[],
  config: WhatsAppConfig,
  template?: string,
  templateParams?: string[]
): Promise<{ success: number; failed: number; errors: string[] }> => {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      const result = await sendWhatsAppMessage({
        to: phoneNumber,
        message,
        template,
        templateParams
      }, config);

      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${phoneNumber}: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      failed++;
      errors.push(`${phoneNumber}: ${error.message || 'Failed to send'}`);
    }
  }

  return { success, failed, errors };
};

