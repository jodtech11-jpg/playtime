/**
 * Script to create a super admin user in Firebase
 * 
 * Usage:
 * node scripts/create-admin-user.js <email> <password> <name>
 * 
 * Example:
 * node scripts/create-admin-user.js admin@playtime.com Admin123! "Super Admin"
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'playtime-d9b83'
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createAdminUser(email, password, name) {
  try {
    console.log(`\n🔐 Creating admin user: ${email}...\n`);

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`⚠️  User with email ${email} already exists. Updating...`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist, create new one
        userRecord = await auth.createUser({
          email: email,
          password: password,
          emailVerified: true,
          displayName: name
        });
        console.log(`✅ User created in Authentication: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // Set custom claims for super admin
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'super_admin',
      admin: true
    });
    console.log(`✅ Custom claims set: super_admin`);

    // Create/Update user document in Firestore
    const userDoc = {
      id: userRecord.uid,
      email: email,
      name: name,
      role: 'super_admin',
      status: 'Active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });
    console.log(`✅ User document created/updated in Firestore`);

    console.log(`\n🎉 Admin user setup complete!\n`);
    console.log(`📋 User Details:`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Role: super_admin`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`\n✅ You can now login with these credentials.\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('\n📝 Usage: node scripts/create-admin-user.js <email> <password> <name>\n');
  console.log('Example:');
  console.log('  node scripts/create-admin-user.js admin@playtime.com Admin123! "Super Admin"\n');
  process.exit(1);
}

const [email, password, name] = args;

// Validate email
if (!email.includes('@')) {
  console.error('❌ Invalid email address');
  process.exit(1);
}

// Validate password (at least 6 characters)
if (password.length < 6) {
  console.error('❌ Password must be at least 6 characters');
  process.exit(1);
}

// Create admin user
createAdminUser(email, password, name);

