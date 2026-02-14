# 💳 Venue Payment Settings Configuration Guide

## Overview

Each venue can have its own payment settings configured, allowing venues to:
- Accept online payments via Razorpay
- Provide bank account details for offline payments
- Set up UPI for quick payments
- Choose which payment methods to accept

---

## How to Add/Configure Payment Settings

### Method 1: During Venue Creation

1. Navigate to **Venues** page
2. Click **"Create Venue"** or **"+ New Venue"** button
3. Fill in the basic venue information
4. Scroll down to the **"Payment Settings"** section
5. Configure the payment options (see details below)
6. Click **"Create Venue"** to save

### Method 2: Edit Existing Venue

1. Navigate to **Venues** page
2. Find the venue you want to configure
3. Click the **Edit** button (pencil icon) on the venue card
4. Scroll down to the **"Payment Settings"** section
5. Update the payment configuration
6. Click **"Update Venue"** to save changes

---

## Payment Settings Configuration

### 1. Razorpay Integration (Online Payments)

**Purpose**: Enable online payment processing for bookings and memberships

**Configuration Steps**:
1. Toggle **"Razorpay Integration"** switch to enable
2. Enter **Razorpay Account ID**:
   - This is your Razorpay merchant account ID
   - Found in your Razorpay Dashboard → Settings → API Keys
   - Format: `rzp_live_xxxxx` or `rzp_test_xxxxx`
3. Enter **Razorpay API Key**:
   - This is your Razorpay API key (secret key)
   - Found in your Razorpay Dashboard → Settings → API Keys
   - **Note**: The API key will be encrypted when saved for security
   - Format: `xxxxx` (alphanumeric string)

**Important Notes**:
- ✅ Enable Razorpay only if you have an active Razorpay account
- ✅ Use test keys for development, live keys for production
- ✅ API keys are encrypted in the database
- ⚠️ Never share your API keys publicly
- ⚠️ Keep your API keys secure and rotate them regularly

**Where to Find Razorpay Credentials**:
1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Go to **Settings** → **API Keys**
3. Copy your **Key ID** (Account ID) and **Key Secret** (API Key)
4. For test mode, use **Test Keys** section
5. For production, use **Live Keys** section

---

### 2. Bank Account Details (Offline Payments)

**Purpose**: Provide bank account information for receiving offline payments (settlements, commissions)

**Configuration Steps**:
1. Enter **Account Holder Name**: Name as it appears on the bank account
2. Enter **Account Number**: Your bank account number
3. Enter **IFSC Code**: Your bank's IFSC code
   - Format: `BANK0000XXX` (11 characters)
   - Example: `HDFC0001234`
4. Enter **Bank Name**: Name of your bank
5. Enter **Branch**: Branch name or location

**Use Cases**:
- Venues receive commission invoices from the platform
- Venues pay platform fees via bank transfer
- Manual settlement processing

**Example**:
```
Account Holder Name: Play Time Sports Complex
Account Number: 1234567890123456
IFSC Code: HDFC0001234
Bank Name: HDFC Bank
Branch: MG Road, Bangalore
```

---

### 3. UPI ID (Quick Payments)

**Purpose**: Enable quick payments via UPI (Unified Payments Interface)

**Configuration Steps**:
1. Enter your **UPI ID** in the field
2. Format examples:
   - `yourname@paytm`
   - `yourname@upi`
   - `yourname@ybl` (PhonePe)
   - `yourname@okaxis` (Axis Bank)
   - `yourname@okhdfcbank` (HDFC Bank)

**Use Cases**:
- Quick payment settlements
- Small amount transactions
- Instant payment confirmations

**Note**: 
- UPI ID must be linked to your bank account
- Ensure the UPI ID is active and verified

---

### 4. Accepted Payment Methods

**Purpose**: Specify which payment methods your venue accepts from customers

**Available Options**:
- ✅ **Bank Transfer**: Direct bank-to-bank transfers
- ✅ **UPI**: Unified Payments Interface (PhonePe, Google Pay, Paytm, etc.)
- ✅ **Cash**: Cash payments at the venue
- ✅ **Cheque**: Cheque payments

**Configuration Steps**:
1. Check the boxes for payment methods you want to accept
2. You can select multiple methods
3. At least one method should be selected

**Recommendations**:
- For online bookings: Enable **UPI** and **Bank Transfer**
- For walk-in customers: Enable **Cash**
- For corporate clients: Enable **Cheque**

---

## Payment Settings Structure

The payment settings are stored in the venue document as follows:

```typescript
{
  paymentSettings: {
    // Razorpay Configuration
    razorpay: {
      enabled: boolean,        // Whether Razorpay is enabled
      accountId: string,        // Razorpay Account ID
      apiKey: string           // Razorpay API Key (encrypted)
    },
    
    // Bank Account Details
    bankAccount: {
      accountHolderName: string,
      accountNumber: string,
      ifscCode: string,
      bankName: string,
      branch: string
    },
    
    // UPI Configuration
    upiId: string,             // UPI ID for quick payments
    
    // Accepted Payment Methods
    paymentMethods: [
      'Bank Transfer',
      'UPI',
      'Cash',
      'Cheque'
    ]
  }
}
```

---

## Security Considerations

### API Key Encryption

- Razorpay API keys are stored securely
- Keys are encrypted at rest in Firestore
- Only authorized users (venue managers, super admins) can view/edit
- API keys are never displayed in plain text after saving

### Access Control

- **Super Admins**: Can configure payment settings for any venue
- **Venue Managers**: Can configure payment settings for their assigned venues only
- **Other Users**: Cannot access payment settings

---

## Testing Payment Settings

### Test Mode (Development)

1. Use Razorpay **Test Keys** from Razorpay Dashboard
2. Test payments will not charge real money
3. Use test card numbers provided by Razorpay
4. Verify payment flow end-to-end

### Production Mode

1. Switch to Razorpay **Live Keys**
2. Ensure all bank account details are correct
3. Verify UPI ID is active
4. Test with small amounts first
5. Monitor payment transactions

---

## Troubleshooting

### Razorpay Not Working

**Issue**: Payments failing or not processing

**Solutions**:
- ✅ Verify Razorpay Account ID is correct
- ✅ Check API Key is valid and not expired
- ✅ Ensure Razorpay account is activated
- ✅ Check Razorpay dashboard for error logs
- ✅ Verify webhook URLs are configured in Razorpay

### Bank Account Details Not Saving

**Issue**: Bank details not persisting

**Solutions**:
- ✅ Ensure all required fields are filled
- ✅ Check IFSC code format is correct (11 characters)
- ✅ Verify account number is valid
- ✅ Check user has permission to edit venue

### UPI Payments Not Working

**Issue**: UPI ID not accepting payments

**Solutions**:
- ✅ Verify UPI ID format is correct
- ✅ Ensure UPI ID is linked to active bank account
- ✅ Check UPI ID is verified in your bank app
- ✅ Try different UPI apps (PhonePe, Google Pay, Paytm)

---

## Best Practices

1. **Regular Updates**: Keep payment settings up-to-date
2. **Security**: Never share API keys or account details
3. **Testing**: Always test in test mode before going live
4. **Monitoring**: Regularly check payment transactions
5. **Backup**: Keep a secure record of payment credentials
6. **Documentation**: Document any custom payment configurations

---

## Support

For payment-related issues:
- **Razorpay Support**: [support.razorpay.com](https://support.razorpay.com)
- **Bank Issues**: Contact your bank directly
- **UPI Issues**: Contact your UPI app support

---

## Quick Reference

| Setting | Required | Format | Example |
|---------|----------|--------|---------|
| Razorpay Account ID | If enabled | `rzp_live_xxxxx` | `rzp_live_ABC123` |
| Razorpay API Key | If enabled | Alphanumeric | `sk_test_xyz789` |
| Account Number | Optional | Numeric | `1234567890123456` |
| IFSC Code | Optional | 11 chars | `HDFC0001234` |
| UPI ID | Optional | `name@provider` | `venue@paytm` |
| Payment Methods | Required | Array | `['UPI', 'Cash']` |

---

**Last Updated**: January 2025

