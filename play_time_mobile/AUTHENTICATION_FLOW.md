# Authentication Flow - Play Time Mobile App

## Overview
The Play Time mobile app supports multiple authentication methods:
1. **Phone Number + OTP** (Primary method)
2. **Google Sign-In**
3. **Apple Sign-In** (UI ready, implementation pending)

---

## Phone Number + OTP Authentication

### Flow
1. **Login Screen** (`login_screen.dart`)
   - User enters phone number (with +91 country code)
   - Clicks "Get OTP" button
   - App calls `AuthProvider.signInWithPhone()`

2. **OTP Verification Screen** (`otp_verification_screen.dart`)
   - User receives 6-digit OTP via SMS
   - User enters OTP in 6 separate input fields
   - Auto-verification when all fields are filled
   - Resend OTP option (60-second cooldown)
   - Change phone number option

3. **User Profile Creation**
   - After successful OTP verification, user profile is automatically created/updated in Firestore
   - Profile stored in `users` collection with:
     - `id`: Firebase Auth UID
     - `phone`: Phone number
     - `email`: Email (if available)
     - `name`: Display name (if available)
     - `photoURL`: Profile photo URL (if available)
     - `role`: 'player' (default)
     - `status`: 'Active'
     - `createdAt`: Timestamp
     - `updatedAt`: Timestamp

### Implementation Details

#### AuthProvider (`providers/auth_provider.dart`)
- `signInWithPhone(phoneNumber)`: Sends OTP to phone number
  - Returns `verificationId` on success
  - Stores `verificationId` and `resendToken` for OTP verification
- `verifyOtp(verificationId, smsCode)`: Verifies OTP code
  - Creates/updates user profile in Firestore
  - Signs in user with Firebase Auth
- `resendOtp(phoneNumber)`: Resends OTP
  - Uses `resendToken` if available
  - 60-second cooldown timer

#### OTP Verification Screen Features
- 6 individual input fields for OTP digits
- Auto-focus next field when digit entered
- Auto-verification when all 6 digits entered
- Resend OTP with 60-second countdown timer
- Error handling with user-friendly messages
- Loading states during verification

---

## Google Sign-In Authentication

### Flow
1. **Login Screen**
   - User clicks "Google" button
   - App calls `AuthProvider.signInWithGoogle()`
   - Google Sign-In dialog appears
   - User selects Google account
   - App receives Google credentials
   - User is signed in with Firebase Auth
   - User profile is created/updated in Firestore

### Implementation Details
- Uses `google_sign_in` package
- Creates/updates user profile in Firestore after successful sign-in
- Profile includes:
  - Google account email
  - Display name
  - Photo URL
  - Phone number (if linked to Google account)

---

## User Profile Management

### Automatic Profile Creation
Both authentication methods automatically create/update user profiles in Firestore:

**Collection**: `users`
**Document ID**: Firebase Auth UID

**Profile Fields**:
```dart
{
  'id': String,              // Firebase Auth UID
  'phone': String?,          // Phone number (from phone auth)
  'email': String?,          // Email (from Google auth or user input)
  'name': String,            // Display name
  'photoURL': String?,       // Profile photo URL
  'role': String,            // 'player' (default)
  'status': String,          // 'Active' (default)
  'createdAt': Timestamp,   // First sign-in timestamp
  'updatedAt': Timestamp,   // Last update timestamp
}
```

### Profile Updates
- Profile is updated on every sign-in
- `updatedAt` timestamp is refreshed
- Existing fields are preserved, new fields are added

---

## Security Features

1. **OTP Verification**
   - 6-digit code sent via SMS
   - 60-second timeout for verification
   - Resend cooldown (60 seconds)
   - Invalid OTP attempts handled gracefully

2. **Session Management**
   - Firebase Auth handles session persistence
   - Auth state listener updates app state automatically
   - Sign-out clears session

3. **Error Handling**
   - User-friendly error messages
   - Network error handling
   - Invalid phone number validation
   - OTP expiration handling

---

## Navigation Flow

```
Login Screen
    ↓
[Phone Login] → OTP Verification Screen → Home Screen
    ↓
[Google Login] → Home Screen
```

### Routes
- `/login`: Login screen
- `/otp-verification`: OTP verification screen (with phone number and verification ID)
- `/home`: Home screen (protected route)

---

## Testing

### Test Phone Numbers
For testing in Firebase Console, you can use test phone numbers:
- Format: `+91XXXXXXXXXX`
- Test OTP codes are available in Firebase Console during development

### Google Sign-In Testing
- Requires Google Sign-In to be configured in Firebase Console
- Test with Google accounts added to Firebase project

---

## Future Enhancements

1. **Apple Sign-In**
   - UI is ready in login screen
   - Implementation pending

2. **Email/Password Authentication**
   - For admin users
   - Can be added if needed

3. **Multi-Factor Authentication**
   - Additional security layer
   - Can be implemented using Firebase MFA

4. **Social Login Options**
   - Facebook Sign-In
   - Twitter Sign-In
   - Can be added based on requirements

---

## Firebase Configuration

### Required Firebase Services
1. **Firebase Authentication**
   - Phone Authentication enabled
   - Google Sign-In enabled
   - Phone number format: E.164 (e.g., +911234567890)

2. **Cloud Firestore**
   - `users` collection for user profiles
   - Security rules configured for user data access

### Android Configuration
- `google-services.json` file in `android/app/`
- Google Maps API key in `AndroidManifest.xml`
- SHA-1/SHA-256 fingerprints added to Firebase project

---

## Error Codes & Handling

### Common Errors
- **Invalid phone number**: User-friendly message
- **OTP expired**: Prompt to resend OTP
- **Invalid OTP**: Clear error message
- **Network error**: Retry option
- **Too many attempts**: Rate limiting message

---

## Code Structure

```
lib/
├── screens/
│   ├── login_screen.dart              # Login UI
│   └── otp_verification_screen.dart   # OTP verification UI
├── providers/
│   └── auth_provider.dart             # Authentication logic
└── services/
    └── firebase_service.dart          # Firebase service wrapper
```

---

## Summary

✅ **OTP Implementation**: Fully implemented with verification screen
✅ **Google Sign-In**: Fully implemented
✅ **User Profile Management**: Automatic creation/update
✅ **Error Handling**: Comprehensive error handling
✅ **Navigation**: Proper routing between screens
✅ **Security**: Firebase Auth security features
✅ **Google Maps API**: Added to AndroidManifest.xml

The authentication system is production-ready and follows Firebase best practices.

