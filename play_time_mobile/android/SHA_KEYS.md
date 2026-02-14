# Android App SHA Keys

## Release Keystore SHA Keys

**Keystore Location:** `android/keystore/playtime-release.jks`  
**Alias:** `playtime`  
**Password:** `playtime2024`

### SHA-1 Fingerprint
```
D3:AF:B8:9A:A7:7F:5A:60:2B:D6:9F:9D:E4:D0:FB:EC:E1:F4:F8:72
```

### SHA-256 Fingerprint
```
14:E5:77:B4:72:E1:21:97:99:83:2E:36:71:DE:AA:BB:95:55:B3:6C:C1:E8:0A:9D:6A:05:D2:07:38:1D:74:8A
```

**Valid Until:** May 28, 2053

---

## Debug Keystore SHA Keys

**Keystore Location:** `%USERPROFILE%\.android\debug.keystore`  
**Alias:** `androiddebugkey`  
**Default Password:** `android`

### SHA-1 Fingerprint
```
D9:35:2F:6C:C3:EC:24:48:81:68:9E:D4:A2:52:0F:3E:69:84:86:3A
```

### SHA-256 Fingerprint
```
C6:B2:6F:48:00:CE:5E:0F:D1:12:7B:FD:A1:A0:9F:E0:E8:AE:7B:51:ED:4D:48:CB:CE:CD:39:08:B1:3C:F5:45
```

**Valid Until:** October 17, 2054

---

## Usage Instructions

### For Firebase/Google Services:
1. Add both SHA-1 and SHA-256 keys to Firebase Console
2. Go to: Firebase Console → Project Settings → Your Android App
3. Add SHA certificate fingerprints (both debug and release)

### For Google Sign-In:
1. Add SHA-1 keys to Google Cloud Console
2. Go to: Google Cloud Console → APIs & Services → Credentials
3. Add SHA-1 fingerprint to OAuth 2.0 Client ID

### For Google Maps API:
1. Add SHA-1 keys to Google Cloud Console
2. Go to: Google Cloud Console → APIs & Services → Credentials
3. Add SHA-1 fingerprint to API Key restrictions

---

## Important Notes

⚠️ **SECURITY WARNING:**
- Never commit the keystore file or key.properties to version control
- Keep the keystore password secure
- The keystore file is already added to .gitignore
- Store backup of the keystore in a secure location

📝 **Key Properties:**
- Store Password: `playtime2024`
- Key Password: `playtime2024`
- Key Alias: `playtime`
- Keystore File: `android/keystore/playtime-release.jks`
