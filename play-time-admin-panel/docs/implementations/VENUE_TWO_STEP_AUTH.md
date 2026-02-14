# 🔐 Venue Two-Step Authentication Implementation

## Overview

Two-step authentication (2FA) has been implemented for venue-related operations to add an extra layer of security when accessing or modifying venue data.

## Features

### 1. **Automatic Route Protection**
- All venue routes (`/venues`, `/venues/:venueId`, `/venues/courts`) require 2FA verification
- Users are prompted to verify when accessing these routes
- Verification is valid for **15 minutes** after successful authentication

### 2. **Operation-Level Protection**
- **Edit Venue**: Requires 2FA before opening edit modal
- **Delete Venue**: Requires 2FA before deletion
- **Create Venue**: Protected at route level (via VenueProtectedRoute)

### 3. **Verification Methods**

#### Password Verification
- User re-enters their password
- Uses Firebase re-authentication for security
- Fast and convenient for users who remember their password

#### OTP Verification
- Sends OTP to user's registered phone number
- Uses Firebase Phone Authentication
- Requires reCAPTCHA verification
- More secure for sensitive operations

### 4. **Smart State Management**
- Verification state persists for 15 minutes
- Automatically expires after timeout
- Cleared when navigating away (optional)
- Shared across all venue pages

## Implementation Details

### Components Created

1. **VenueTwoStepAuthContext** (`contexts/VenueTwoStepAuthContext.tsx`)
   - Manages verification state
   - Handles password and OTP verification
   - Tracks verification expiry (15 minutes)

2. **VenueTwoStepAuthModal** (`components/VenueTwoStepAuthModal.tsx`)
   - User-friendly modal for 2FA
   - Supports both password and OTP methods
   - Shows security notice and expiry information

3. **VenueProtectedRoute** (`components/VenueProtectedRoute.tsx`)
   - Wrapper around ProtectedRoute
   - Automatically triggers 2FA for venue routes
   - Handles verification flow

### Integration Points

1. **App.tsx**
   - Wrapped with `VenueTwoStepAuthProvider`
   - Venue routes use `VenueProtectedRoute` instead of `ProtectedRoute`

2. **Venues.tsx**
   - Edit and Delete operations require 2FA
   - Shows 2FA modal before sensitive operations

3. **VenueDetail.tsx**
   - Edit operation requires 2FA
   - Integrated with 2FA modal

## Usage Flow

### Route-Level Protection
1. User navigates to `/venues` or any venue route
2. `VenueProtectedRoute` checks if user is verified
3. If not verified, shows `VenueTwoStepAuthModal`
4. User verifies using password or OTP
5. Verification state is set (valid for 15 minutes)
6. User can now access venue pages

### Operation-Level Protection
1. User clicks "Edit" or "Delete" on a venue
2. System checks if user is verified
3. If not verified, shows 2FA modal
4. User verifies
5. Operation proceeds automatically after verification

## Security Features

### Password Verification
- Uses Firebase `reauthenticateWithCredential`
- Ensures user is still the account owner
- Prevents unauthorized access if session is hijacked

### OTP Verification
- Sends OTP to registered phone number
- Requires reCAPTCHA to prevent abuse
- 6-digit code validation
- Time-limited verification

### Verification Expiry
- 15-minute validity period
- Automatically expires for security
- User must re-verify after expiry

## Configuration

### Verification Timeout
Default: **15 minutes**

To change, modify `VenueTwoStepAuthContext.tsx`:
```typescript
setVerificationExpiry(Date.now() + 15 * 60 * 1000); // Change 15 to desired minutes
```

### Routes Requiring 2FA
Currently protected routes:
- `/venues`
- `/venues/:venueId`
- `/venues/courts`

To add more routes, update `VenueProtectedRoute.tsx`:
```typescript
const isVenueRoute = location.pathname.startsWith('/venues') || 
                     location.pathname.startsWith('/courts') ||
                     location.pathname.startsWith('/your-new-route');
```

## OTP Implementation

✅ **OTP Implementation**: The OTP verification uses Firebase Phone Authentication.

### How It Works
1. User requests OTP → System sends OTP to user's registered phone number
2. User enters OTP → Firebase verifies the code
3. System checks phone number matches user's profile
4. If verified, sets 2FA state (valid for 15 minutes)

### Important Notes

**Phone Number Requirements**:
- User must have a phone number in their profile (`user.phone`)
- Phone number should be in international format (e.g., `+1234567890`)
- Phone number in profile should match the phone number linked to their Firebase Auth account

**Session Handling**:
- Firebase Phone Auth signs in with the phone number
- System verifies the phone matches the user's profile
- If phone is linked to a different account, verification fails
- Original session is preserved if phone matches the logged-in user

**For Production Enhancements**:
- Consider using Firebase Multi-Factor Authentication (MFA) for better integration
- Or implement a custom OTP service (Twilio, AWS SNS) for more control
- Add phone number validation and formatting helpers

## User Experience

### Positive Aspects
- ✅ Clear security notice explaining why 2FA is required
- ✅ Choice between password and OTP methods
- ✅ 15-minute validity reduces friction
- ✅ Automatic verification for subsequent operations
- ✅ Smooth modal experience

### Security Benefits
- ✅ Prevents unauthorized venue modifications
- ✅ Adds extra layer for sensitive operations
- ✅ Session-based verification (not per-action)
- ✅ Automatic expiry prevents stale sessions

## Testing

### Test Scenarios
1. Navigate to `/venues` → Should show 2FA modal
2. Verify with password → Should access venues page
3. Navigate to venue detail → Should not require re-verification (within 15 min)
4. Click Edit → Should open edit modal (already verified)
5. Wait 15+ minutes → Should require re-verification
6. Click Delete → Should require 2FA if not verified

## Future Enhancements

- [ ] Biometric authentication support
- [ ] Email-based OTP option
- [ ] Configurable verification timeout per user role
- [ ] Audit log for 2FA verifications
- [ ] Remember device option (30-day exemption)
- [ ] Admin override for emergency access

