/**
 * One-time repair for PDF correction leftovers:
 * - Sync venues.managerId from venue_manager.managedVenues
 * - Tag venue staff with ownerScope: 'vendor'
 * - Extend expired Live marketing campaigns
 * - Seed a sample marketplace product if none exist
 * - Add placeholder images for venues missing gallery photos
 *
 * Usage: node scripts/repair-correction-data.js
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(
  __dirname,
  '..',
  'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json'
);

const sa = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: 'playtime-d9b83',
  });
}

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const VENUE_PLACEHOLDERS = {
  default:
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80',
  swim: 'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=1200&q=80',
  cricket:
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&q=80',
  badminton:
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=1200&q=80',
};

function pickPlaceholder(venue) {
  const sports = (venue.sports || []).join(' ').toLowerCase();
  if (sports.includes('swim')) return VENUE_PLACEHOLDERS.swim;
  if (sports.includes('cricket')) return VENUE_PLACEHOLDERS.cricket;
  if (sports.includes('badminton')) return VENUE_PLACEHOLDERS.badminton;
  return VENUE_PLACEHOLDERS.default;
}

async function syncManagerIds() {
  const usersSnap = await db
    .collection('users')
    .where('role', '==', 'venue_manager')
    .get();

  let updated = 0;
  for (const doc of usersSnap.docs) {
    const managed = (doc.data().managedVenues || []).filter(Boolean);
    for (const venueId of managed) {
      const venueRef = db.collection('venues').doc(venueId);
      const venueSnap = await venueRef.get();
      if (!venueSnap.exists) continue;
      if (venueSnap.data().managerId === doc.id) continue;
      await venueRef.update({
        managerId: doc.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated += 1;
      console.log(`  venue ${venueId} → managerId ${doc.id}`);
    }
  }
  console.log(`✓ Synced managerId on ${updated} venue(s)`);
}

async function tagVendorStaff() {
  const staffSnap = await db.collection('staff').get();
  let updated = 0;
  for (const doc of staffSnap.docs) {
    const data = doc.data();
    if (data.ownerScope) continue;
    if (!data.venueId) continue;
    await doc.ref.update({
      ownerScope: 'vendor',
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
  }
  console.log(`✓ Tagged ${updated} staff as ownerScope=vendor`);
}

async function repairCampaigns() {
  const snap = await db.collection('marketingCampaigns').get();
  const now = new Date();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.status !== 'Live') continue;
    const end = data.endDate?.toDate?.() || null;
    if (end && end >= now) continue;
    const newEnd = new Date(now);
    newEnd.setDate(newEnd.getDate() + 30);
    await doc.ref.update({
      startDate: Timestamp.fromDate(now),
      endDate: Timestamp.fromDate(newEnd),
      status: 'Live',
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
    console.log(`  campaign "${data.title}" end → ${newEnd.toISOString()}`);
  }
  console.log(`✓ Extended ${updated} Live campaign(s)`);
}

async function seedMarketplaceProduct() {
  const productsSnap = await db.collection('products').limit(1).get();
  if (!productsSnap.empty) {
    console.log('✓ Marketplace already has products — skip seed');
    return;
  }

  const categoriesSnap = await db.collection('categories').limit(1).get();
  const categoryId = categoriesSnap.empty
    ? 'General'
    : categoriesSnap.docs[0].id;
  const categoryName = categoriesSnap.empty
    ? 'General'
    : categoriesSnap.docs[0].data().name || 'General';

  const ref = db.collection('products').doc();
  await ref.set({
    name: 'Pro Grip Tape',
    description: 'Anti-slip grip tape for racquets and bats. Sample marketplace listing.',
    category: categoryId,
    categoryName,
    price: 149,
    originalPrice: 199,
    discount: 25,
    stock: 40,
    minStock: 5,
    sku: 'PT-GRIP-001',
    venueId: 'VEN-1782549243852',
    venueName: 'Auro Swimming Pool',
    images: [
      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
    ],
    tags: ['grip', 'accessories'],
    isFeatured: true,
    status: 'In Stock',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ Seeded marketplace product ${ref.id}`);
}

async function repairVenueImages() {
  const snap = await db.collection('venues').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    if (images.length > 0) continue;
    const url = pickPlaceholder(data);
    await doc.ref.update({
      images: [url],
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
    console.log(`  venue "${data.name}" → placeholder image`);
  }
  console.log(`✓ Added images to ${updated} venue(s)`);
}

async function main() {
  console.log('\nRepairing Playtime correction data...\n');
  await syncManagerIds();
  await tagVendorStaff();
  await repairCampaigns();
  await seedMarketplaceProduct();
  await repairVenueImages();
  console.log('\nDone.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
