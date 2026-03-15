# 🚀 Play Time Admin Panel - Setup Instructions

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Firebase project created (playtime-d9b83)
- Firebase Admin SDK JSON file (already in project)

---

## Step 1: Install Dependencies

```bash
cd play-time-admin-panel
npm install
```

This will install:
- React 19.2.3
- React Router DOM 7.11.0
- Firebase 10.13.0
- Recharts 3.6.0
- TypeScript 5.8.2
- Vite 6.2.0

---

## Step 2: Firebase Configuration

### 2.1 Get Firebase Web App Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **playtime-d9b83**
3. Click the gear icon ⚙️ → Project Settings
4. Scroll down to "Your apps" section
5. If you don't have a web app, click "Add app" → Web (</> icon)
6. Copy the Firebase configuration object

### 2.2 Create Environment File

Create a `.env` file in the `play-time-admin-panel` directory:

```bash
# Copy the example file
cp .env.example .env
```

### 2.3 Add Firebase Config to .env

Open `.env` and add your Firebase config values:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=playtime-d9b83.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=playtime-d9b83
VITE_FIREBASE_STORAGE_BUCKET=playtime-d9b83.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

**Where to find these values:**
- All values except VAPID_KEY: Firebase Console → Project Settings → Your apps → Web app config
- VAPID_KEY: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair

---

## Step 3: Firebase Services Setup

### 3.1 Enable Authentication

1. Firebase Console → Authentication → Get Started
2. Enable sign-in methods:
   - **Email/Password** (for admin login)
   - **Phone** (for OTP login - as per project requirements)
   - **Google** (optional)

### 3.2 Enable Firestore Database

1. Firebase Console → Firestore Database → Create Database
2. Start in **Production mode** (we'll add security rules later)
3. Choose a location (preferably close to your users in Tamil Nadu, India)
4. Click Enable

### 3.3 Enable Storage

1. Firebase Console → Storage → Get Started
2. Start in **Production mode**
3. Choose same location as Firestore
4. Click Done

### 3.4 Enable Cloud Messaging (FCM)

1. Firebase Console → Cloud Messaging
2. Enable Cloud Messaging API
3. Generate Web Push certificate (for VAPID key)

---

## Step 4: Firestore Security Rules

Create security rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user is super admin
    function isSuperAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    // Helper function to check if user is venue manager
    function isVenueManager() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'venue_manager';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isSuperAdmin();
    }
    
    // Venues collection
    match /venues/{venueId} {
      allow read: if isAuthenticated();
      allow create: if isSuperAdmin();
      allow update, delete: if isSuperAdmin() || 
        (isVenueManager() && resource.data.managerId == request.auth.uid);
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isSuperAdmin() || 
        (isVenueManager() && resource.data.venueId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.managedVenues);
    }
    
    // Add more rules for other collections as needed
    // Memberships, Courts, Posts, Products, Orders, etc.
  }
}
```

**Note**: These are basic rules. Adjust based on your specific requirements.

---

## Step 5: Storage Security Rules

Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && 
             firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
    
    // Venue images
    match /venues/{venueId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin() || 
        (isAuthenticated() && request.resource.size < 5 * 1024 * 1024); // 5MB limit
    }
    
    // User avatars
    match /users/{userId}/avatar/{fileName} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == userId && request.resource.size < 2 * 1024 * 1024; // 2MB limit
    }
    
    // Product images
    match /products/{productId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin() && request.resource.size < 5 * 1024 * 1024;
    }
    
    // Post images (social feed)
    match /posts/{postId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.resource.size < 10 * 1024 * 1024; // 10MB limit
    }
  }
}
```

---

## Step 6: Run the Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`

---

## Step 7: Initialize Firebase in Your App

The Firebase service is already created at `services/firebase.ts`. 

To use it in your components:

```typescript
import { auth, db, signInEmailPassword, bookingsCollection } from '@/services/firebase';
```

---

## Step 8: Create Initial Admin User

### Option 1: Using Firebase Console
1. Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Create user document in Firestore:
   - Collection: `users`
   - Document ID: (user's UID from Authentication)
   - Data:
     ```json
     {
       "email": "admin@playtime.com",
       "name": "Admin User",
       "role": "super_admin",
       "createdAt": [timestamp],
       "updatedAt": [timestamp]
     }
     ```

### Option 2: Using Firebase Admin SDK (Backend)
Create a script to initialize admin users (recommended for production).

---

## Step 9: Test Firebase Integration

1. Try logging in with the admin credentials
2. Check browser console for any Firebase errors
3. Verify Firestore connection by checking Network tab
4. Test file upload to Storage
5. Test FCM token generation (check browser console)

---

## Troubleshooting

### Firebase not initializing
- Check `.env` file exists and has correct values
- Verify all environment variables are prefixed with `VITE_`
- Restart dev server after changing `.env`

### Authentication not working
- Check Firebase Console → Authentication is enabled
- Verify sign-in methods are enabled
- Check browser console for error messages

### Firestore permission denied
- Check Firestore security rules
- Verify user is authenticated
- Check user role in Firestore `users` collection

### Storage upload fails
- Check Storage security rules
- Verify file size limits
- Check Storage is enabled in Firebase Console

### FCM not working
- Verify VAPID key is set in `.env`
- Check browser supports notifications
- Verify Cloud Messaging API is enabled

---

## Next Steps

1. ✅ Firebase service setup (DONE)
2. Integrate authentication in Login page
3. Connect Dashboard to Firestore
4. Implement Bookings CRUD
5. Continue with other features (see MISSING_FEATURES_ANALYSIS.md)

---

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Auth Guide](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Storage Guide](https://firebase.google.com/docs/storage)
- [FCM Web Setup](https://firebase.google.com/docs/cloud-messaging/js/client)

---

**Need Help?** Check `MISSING_FEATURES_ANALYSIS.md` for detailed feature requirements.

