# 🔥 Firebase Deployment Guide

This guide will help you deploy Firestore rules, indexes, and Storage rules to Firebase.

## Prerequisites

1. ✅ Firebase CLI installed (already done)
2. ✅ Firebase project created: `playtime-d9b83`
3. ✅ Logged in to Firebase CLI

## Step 1: Get Firebase Config Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **playtime-d9b83**
3. Click the gear icon ⚙️ > **Project Settings**
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** > **Web** (</> icon)
6. Copy the config values:
   - `apiKey`
   - `authDomain`
   - `projectId` (should be `playtime-d9b83`)
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
   - `measurementId` (optional, for Analytics)

## Step 2: Create .env File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Firebase config values:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=playtime-d9b83.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=playtime-d9b83
   VITE_FIREBASE_STORAGE_BUCKET=playtime-d9b83.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
   VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
   ```

## Step 3: Login to Firebase CLI

If you haven't logged in yet:
```bash
firebase login
```

This will open a browser window for authentication.

## Step 4: Initialize Firebase Project (if needed)

If Firebase is not initialized in this directory:
```bash
firebase init
```

Select:
- ✅ Firestore: Configure security rules and indexes
- ✅ Storage: Configure security rules
- Use existing project: **playtime-d9b83**

## Step 5: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## Step 6: Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

**Note**: Index creation can take a few minutes. You can check status in Firebase Console > Firestore > Indexes.

## Step 7: Deploy Storage Rules

```bash
firebase deploy --only storage
```

## Step 8: Deploy All at Once

To deploy everything at once:
```bash
firebase deploy
```

Or deploy specific services:
```bash
firebase deploy --only firestore,storage
```

## Step 9: Verify Deployment

1. **Firestore Rules**: 
   - Go to Firebase Console > Firestore Database > Rules
   - Verify your rules are deployed

2. **Firestore Indexes**:
   - Go to Firebase Console > Firestore Database > Indexes
   - Check that indexes are building/completed

3. **Storage Rules**:
   - Go to Firebase Console > Storage > Rules
   - Verify your rules are deployed

## Troubleshooting

### Error: "Project not found"
- Make sure you're logged in: `firebase login`
- Check project ID in `.firebaserc`: should be `playtime-d9b83`

### Error: "Permission denied"
- Make sure you have Owner or Editor role on the Firebase project
- Check in Firebase Console > Project Settings > Users and permissions

### Index Build Timeout
- Firestore indexes can take 5-10 minutes to build
- Check status in Firebase Console
- Large collections may take longer

### Rules Validation Errors
- Test rules in Firebase Console > Firestore > Rules > Rules Playground
- Check syntax with: `firebase deploy --only firestore:rules --dry-run`

## Quick Commands Reference

```bash
# Login
firebase login

# Check current project
firebase projects:list

# Set project
firebase use playtime-d9b83

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy Storage rules
firebase deploy --only storage

# Deploy everything
firebase deploy

# View deployment history
firebase deploy:list
```

## Files Created

- `firebase.json` - Firebase CLI configuration
- `.firebaserc` - Firebase project configuration
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore composite indexes
- `storage.rules` - Storage security rules
- `.env.example` - Environment variables template

## Next Steps

1. ✅ Create `.env` file with your Firebase config
2. ✅ Deploy rules and indexes
3. ✅ Test your application
4. ✅ Monitor Firebase Console for any errors

---

**Status**: Ready to deploy! 🚀

