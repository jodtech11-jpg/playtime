/**
 * Check Firestore courts/venues and sync venue.courts from courts collection.
 * Use Firebase CLI / Node to verify data and fix "no court available" in mobile.
 *
 * Usage: node scripts/check-and-sync-courts.js
 * (from play-time-admin-panel directory)
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (e) {
  console.error('Service account not found at', serviceAccountPath);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'playtime-d9b83',
  });
}

const db = admin.firestore();

async function main() {
  console.log('\n--- Firestore: Venues & Courts check ---\n');

  const venuesSnap = await db.collection('venues').get();
  const venues = venuesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log(`Venues: ${venues.length}\n`);

  for (const venue of venues) {
    const courtsSnap = await db
      .collection('courts')
      .where('venueId', '==', venue.id)
      .get();
    const courts = courtsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const activeCount = courts.filter((c) => (c.status || '') === 'Active').length;
    console.log(
      `Venue: ${venue.name || venue.id} (${venue.id})\n  Courts in collection: ${courts.length} (Active: ${activeCount})`
    );
    if (courts.length > 0) {
      courts.slice(0, 3).forEach((c) => {
        const avail = c.availability || {};
        const keys = Object.keys(avail);
        console.log(`    - ${c.id}: ${c.name} status=${c.status} availability keys=[${keys.join(', ')}]`);
        if (keys.length > 0) {
          const mon = avail.Monday || avail.monday;
          console.log(`      Monday sample: ${JSON.stringify(mon)}`);
        }
      });
      if (courts.length > 3) console.log(`    ... and ${courts.length - 3} more`);
    }

    const existingCourtsArray = Array.isArray(venue.courts) ? venue.courts : [];
    console.log(`  Venue doc courts array length: ${existingCourtsArray.length}`);

    if (courts.length > 0) {
      await db.collection('venues').doc(venue.id).update({
        courts: courts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  Synced venue.courts with ${courts.length} court(s).`);
    }
    console.log('');
  }

  console.log('Done. Mobile app can use courts from collection or venue.courts.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
