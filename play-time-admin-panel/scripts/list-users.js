/**
 * Script to list all users in Firebase Authentication and their Firestore documents
 * 
 * Usage:
 * node scripts/list-users.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json');

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'playtime-d9b83'
    });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  async function listUsers() {
    try {
      console.log('\n🔍 Fetching all users...\n');

      // List all users from Authentication
      const listUsersResult = await auth.listUsers();
      const users = listUsersResult.users;

      if (users.length === 0) {
        console.log('❌ No users found in Firebase Authentication.\n');
        process.exit(0);
      }

      console.log(`Found ${users.length} user(s):\n`);
      console.log('─'.repeat(80));

      // Check Firestore documents for each user
      for (const user of users) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const role = userData?.role || '❌ MISSING';
        const status = userData?.status || '❌ MISSING';

        console.log(`\n📧 Email: ${user.email || 'N/A'}`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   Role: ${role}`);
        console.log(`   Status: ${status}`);
        console.log(`   Firestore Document: ${userDoc.exists ? '✅ Exists' : '❌ Missing'}`);
        
        if (user.customClaims) {
          console.log(`   Custom Claims: ${JSON.stringify(user.customClaims)}`);
        }
      }

      console.log('\n' + '─'.repeat(80));
      console.log('\n💡 To update a user role, run:');
      console.log('   npm run update-user-role <email> <role>');
      console.log('   Example: npm run update-user-role admin@playtime.com super_admin\n');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error listing users:', error.message);
      console.error(error);
      process.exit(1);
    }
  }

  listUsers();
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('\n❌ Error: Service account key file not found!');
    console.error(`Expected path: ${serviceAccountPath}`);
    console.error('Please download your service account key from Firebase Console:');
    console.error('Project Settings → Service Accounts → Generate New Private Key\n');
  } else {
    console.error('\n❌ Error:', error.message);
  }
  process.exit(1);
}

