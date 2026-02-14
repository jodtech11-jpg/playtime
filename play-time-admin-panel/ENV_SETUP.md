# 🔐 Environment Variables Setup

## ✅ Firebase Deployment Complete!

All Firebase rules and indexes have been successfully deployed:
- ✅ Firestore Rules - Deployed
- ✅ Firestore Indexes - Deployed  
- ✅ Storage Rules - Deployed

## 📝 Create .env File

Since `.env` files are in `.gitignore` (for security), you need to create it manually.

### Steps:

1. **Create a new file** named `.env` in the `play-time-admin-panel` directory

2. **Copy and paste** the following content:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyA_VF4VE48QsNTwoq6XMP1gZ_mA4utbkmg
VITE_FIREBASE_AUTH_DOMAIN=playtime-d9b83.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=playtime-d9b83
VITE_FIREBASE_STORAGE_BUCKET=playtime-d9b83.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=721347779964
VITE_FIREBASE_APP_ID=1:721347779964:web:c1af6a9d7116d7b1bed8f9
VITE_FIREBASE_MEASUREMENT_ID=G-DB79L3E8TD

# Firebase Cloud Messaging (FCM) VAPID Key (Optional)
# Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
VITE_FIREBASE_VAPID_KEY=
```

3. **Save the file**

4. **Restart your development server** for the changes to take effect:
   ```bash
   npm run dev
   ```

## 🔍 Verify Setup

After creating the `.env` file and restarting:

1. Open your browser console
2. Check that there are no Firebase config errors
3. Try logging in - authentication should work now!

## 📋 Optional: VAPID Key for Push Notifications

If you want to enable Firebase Cloud Messaging (FCM) push notifications:

1. Go to Firebase Console > Project Settings > Cloud Messaging
2. Scroll to "Web Push certificates"
3. If no key exists, click "Generate key pair"
4. Copy the key and add to `.env`:
   ```
   VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
   ```

## ✅ All Set!

Your Firebase configuration is complete. The application should now work without the "Missing Firebase config values" error.

---

**Note**: The `.env` file is in `.gitignore` to keep your API keys secure. Never commit this file to version control!

