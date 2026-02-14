# 🔥 Get Firebase Web App Config

## Quick Steps

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select Project**: `playtime-d9b83`
3. **Click Gear Icon** ⚙️ > **Project Settings**
4. **Scroll to "Your apps"** section
5. **If no Web app exists**, click **Add app** > **Web** (</> icon)
6. **Copy the config** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "playtime-d9b83.firebaseapp.com",
  projectId: "playtime-d9b83",
  storageBucket: "playtime-d9b83.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXXXXX"
};
```

7. **Create `.env` file** in `play-time-admin-panel` directory:

```env
VITE_FIREBASE_API_KEY=AIzaSy... (paste your apiKey here)
VITE_FIREBASE_AUTH_DOMAIN=playtime-d9b83.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=playtime-d9b83
VITE_FIREBASE_STORAGE_BUCKET=playtime-d9b83.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 (paste your messagingSenderId)
VITE_FIREBASE_APP_ID=1:123456789:web:abc123 (paste your appId)
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX (optional)
VITE_FIREBASE_VAPID_KEY= (get from Cloud Messaging > Web Push certificates)
```

## Get VAPID Key (for FCM)

1. Firebase Console > **Project Settings** > **Cloud Messaging** tab
2. Scroll to **Web Push certificates**
3. If no key exists, click **Generate key pair**
4. Copy the key and add to `.env` as `VITE_FIREBASE_VAPID_KEY`

---

**After creating `.env` file, restart your dev server!**

