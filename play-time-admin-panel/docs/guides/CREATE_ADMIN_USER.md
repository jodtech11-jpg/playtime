# 👤 Create Admin User Guide

This guide explains how to create a super admin user in Firebase using the Firebase Admin SDK.

## Prerequisites

- ✅ Firebase Admin SDK installed (`firebase-admin`)
- ✅ Service account JSON file present
- ✅ Firebase project initialized

## Method 1: Using the Script (Recommended)

### Step 1: Run the script

```bash
npm run create-admin <email> <password> <name>
```

### Example:

```bash
npm run create-admin admin@playtime.com Admin123! "Super Admin"
```

Or directly with node:

```bash
node scripts/create-admin-user.js admin@playtime.com Admin123! "Super Admin"
```

### What the script does:

1. ✅ Creates user in Firebase Authentication
2. ✅ Sets custom claims (role: super_admin)
3. ✅ Creates user document in Firestore `users` collection
4. ✅ Sets role to `super_admin`
5. ✅ Sets status to `Active`

## Method 2: Manual Creation via Firebase Console

### Step 1: Create User in Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/project/playtime-d9b83/authentication/users)
2. Click **Add user**
3. Enter email and password
4. Click **Add user**

### Step 2: Create User Document in Firestore

1. Go to [Firestore Database](https://console.firebase.google.com/project/playtime-d9b83/firestore)
2. Navigate to `users` collection
3. Click **Add document**
4. Set Document ID to the user's UID (from Authentication)
5. Add fields:
   ```json
   {
     "id": "<user-uid>",
     "email": "admin@playtime.com",
     "name": "Super Admin",
     "role": "super_admin",
     "status": "Active",
     "createdAt": [timestamp],
     "updatedAt": [timestamp]
   }
   ```

### Step 3: Set Custom Claims (Optional)

You can set custom claims using the script or Firebase Admin SDK in your backend.

## User Document Structure

```typescript
{
  id: string;              // Firebase Auth UID
  email: string;           // User email
  name: string;            // Display name
  role: 'super_admin' | 'venue_manager';
  status: 'Active' | 'Pending' | 'Inactive';
  phone?: string;          // Optional phone number
  avatar?: string;         // Optional avatar URL
  venueIds?: string[];     // For venue managers
  managedVenues?: string[]; // Venue IDs this manager manages
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Roles

### Super Admin (`super_admin`)
- Full access to all features
- Can access CRM page
- Can approve/reject venues
- Can manage all venues and users

### Venue Manager (`venue_manager`)
- Limited to assigned venues
- Can manage bookings, memberships, staff for their venues
- Cannot access CRM page

## Troubleshooting

### "User already exists"
- The script will update the existing user
- User document in Firestore will be updated
- Custom claims will be set

### "Permission denied"
- Check that service account has proper permissions
- Verify service account JSON file is correct

### "Invalid email"
- Ensure email format is correct
- Email must contain '@' symbol

### "Password too short"
- Password must be at least 6 characters
- Use a strong password for admin accounts

## Security Notes

⚠️ **Important Security Considerations:**

1. **Strong Password**: Use a strong, unique password for admin accounts
2. **Service Account**: Keep the service account JSON file secure
3. **Environment Variables**: Never commit `.env` or service account files
4. **Custom Claims**: Custom claims are cached, may take a few minutes to update
5. **Role Verification**: Always verify user role in Firestore, not just custom claims

## Testing

After creating the admin user:

1. Go to the login page
2. Enter the email and password
3. You should be logged in as super admin
4. Check that you can access all features including CRM

## Multiple Admin Users

You can create multiple admin users by running the script multiple times with different emails:

```bash
npm run create-admin admin1@playtime.com Password123! "Admin One"
npm run create-admin admin2@playtime.com Password123! "Admin Two"
```

---

**Status**: ✅ Admin user creation script ready to use!

