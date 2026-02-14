/**
 * Script to update user role in Firestore
 * 
 * Usage:
 * node scripts/update-user-role.js <email> <role>
 * 
 * Example:
 * node scripts/update-user-role.js admin@playtime.com super_admin
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json');

if (!existsSync(serviceAccountPath)) {
  console.error('\n❌ Error: Service account key file not found!');
  console.error(`Expected path: ${serviceAccountPath}`);
  console.error('Please download your service account key from Firebase Console:');
  console.error('Project Settings → Service Accounts → Generate New Private Key\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'playtime-d9b83'
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function updateUserRole(email, role) {
  try {
    if (!email || !role) {
      console.error('\n❌ Error: Email and role are required!');
      console.error('Usage: node scripts/update-user-role.js <email> <role>');
      console.error('Example: node scripts/update-user-role.js admin@playtime.com super_admin');
      console.error('\nValid roles: player, super_admin, venue_manager\n');
      process.exit(1);
    }

    if (role !== 'player' && role !== 'super_admin' && role !== 'venue_manager') {
      console.error('\n❌ Error: Invalid role!');
      console.error('Valid roles: player, super_admin, venue_manager\n');
      process.exit(1);
    }

    console.log(`\n🔍 Looking up user: ${email}...\n`);

    // Get user by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`✅ Found user in Authentication: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`\n❌ Error: User with email ${email} not found in Authentication!`);
        console.error('Please create the user first in Firebase Console → Authentication → Users\n');
        process.exit(1);
      } else {
        throw error;
      }
    }

    // Check if user document exists in Firestore
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.log(`⚠️  User document not found in Firestore. Creating new document...`);
      
      // Create new user document
      const userData = {
        id: userRecord.uid,
        email: email,
        name: userRecord.displayName || email.split('@')[0],
        role: role,
        status: 'Active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await userDocRef.set(userData, { merge: true });
      console.log(`✅ User document created in Firestore`);
    } else {
      console.log(`✅ User document found in Firestore. Updating role...`);
      
      // Update existing user document
      const currentData = userDoc.data();
      await userDocRef.set({
        ...currentData,
        role: role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log(`✅ User role updated from '${currentData.role || 'none'}' to '${role}'`);
    }

    // Update custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: role,
      admin: role === 'super_admin'
    });
    console.log(`✅ Custom claims updated`);

    console.log(`\n🎉 User role update complete!\n`);
    console.log(`📋 Updated User Details:`);
    console.log(`   Email: ${email}`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Role: ${role}`);
    console.log(`\n✅ The user can now access features based on their role.\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating user role:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('\n❌ Error: Email and role are required!');
  console.error('Usage: node scripts/update-user-role.js <email> <role>');
  console.error('Example: node scripts/update-user-role.js admin@playtime.com super_admin');
  console.error('\nValid roles: super_admin, venue_manager\n');
  process.exit(1);
}

const [email, role] = args;
updateUserRole(email, role);

