/**
 * Backfill venueId on legacy invoices (and optionally support tickets).
 *
 * Usage:
 *   node scripts/backfill-venue-ids.mjs
 *   node scripts/backfill-venue-ids.mjs --dry-run
 *
 * Logic for invoices missing venueId:
 *   1. If sourceId matches a venue id → use it (legacy commission pattern)
 *   2. Else if type Booking → look up booking.sourceId → booking.venueId
 *   3. Else if type Membership → look up membership → venueId
 *   4. Else if type Settlement with sourceId 'platform' → leave unset (platform-only)
 *
 * Support tickets: only backfills when a related bookingId/orderId field exists
 * (most mobile tickets may already have venueId or remain super-admin-only).
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dryRun = process.argv.includes('--dry-run');

const serviceAccountPath = join(
  __dirname,
  '..',
  'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json'
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'playtime-d9b83',
  });
}

const db = admin.firestore();

async function loadVenueIds() {
  const snap = await db.collection('venues').select().get();
  return new Set(snap.docs.map((d) => d.id));
}

async function resolveInvoiceVenueId(data, venueIds, cache) {
  if (data.venueId) return null; // already set

  const sourceId = data.sourceId;
  if (!sourceId) return null;

  // Legacy commission / settlement invoices often stored venue id in sourceId
  if (venueIds.has(sourceId) || String(sourceId).startsWith('VEN-')) {
    return sourceId;
  }

  if (data.type === 'Booking') {
    if (!cache.bookings.has(sourceId)) {
      const doc = await db.collection('bookings').doc(sourceId).get();
      cache.bookings.set(sourceId, doc.exists ? doc.data()?.venueId || null : null);
    }
    return cache.bookings.get(sourceId);
  }

  if (data.type === 'Membership') {
    if (!cache.memberships.has(sourceId)) {
      const doc = await db.collection('memberships').doc(sourceId).get();
      cache.memberships.set(sourceId, doc.exists ? doc.data()?.venueId || null : null);
    }
    return cache.memberships.get(sourceId);
  }

  // Settlement / platform invoices intentionally have no venueId
  return null;
}

async function backfillInvoices(venueIds) {
  const snap = await db.collection('invoices').get();
  const cache = { bookings: new Map(), memberships: new Map() };
  let updated = 0;
  let skipped = 0;
  let already = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.venueId) {
      already++;
      continue;
    }

    const venueId = await resolveInvoiceVenueId(data, venueIds, cache);
    if (!venueId) {
      skipped++;
      console.log(`  skip invoice ${doc.id} type=${data.type} sourceId=${data.sourceId}`);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] invoice ${doc.id} → venueId=${venueId}`);
    } else {
      await doc.ref.update({
        venueId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  updated invoice ${doc.id} → venueId=${venueId}`);
    }
    updated++;
  }

  return { updated, skipped, already, total: snap.size };
}

async function backfillSupportTickets(venueIds) {
  const snap = await db.collection('supportTickets').get();
  let updated = 0;
  let skipped = 0;
  let already = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.venueId) {
      already++;
      continue;
    }

    let venueId = null;
    if (data.bookingId) {
      const booking = await db.collection('bookings').doc(data.bookingId).get();
      venueId = booking.exists ? booking.data()?.venueId || null : null;
    } else if (data.relatedBookingId) {
      const booking = await db.collection('bookings').doc(data.relatedBookingId).get();
      venueId = booking.exists ? booking.data()?.venueId || null : null;
    } else if (data.membershipId) {
      const membership = await db.collection('memberships').doc(data.membershipId).get();
      venueId = membership.exists ? membership.data()?.venueId || null : null;
    } else if (data.sourceId && venueIds.has(data.sourceId)) {
      venueId = data.sourceId;
    }

    if (!venueId) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] ticket ${doc.id} → venueId=${venueId}`);
    } else {
      await doc.ref.update({
        venueId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  updated ticket ${doc.id} → venueId=${venueId}`);
    }
    updated++;
  }

  return { updated, skipped, already, total: snap.size };
}

async function main() {
  console.log(`\nBackfill venueId ${dryRun ? '(DRY RUN)' : ''}\n`);
  const venueIds = await loadVenueIds();
  console.log(`Loaded ${venueIds.size} venues\n`);

  console.log('Invoices...');
  const invoices = await backfillInvoices(venueIds);
  console.log(
    `  invoices: ${invoices.updated} updated, ${invoices.already} already set, ${invoices.skipped} skipped, ${invoices.total} total\n`
  );

  console.log('Support tickets...');
  const tickets = await backfillSupportTickets(venueIds);
  console.log(
    `  tickets: ${tickets.updated} updated, ${tickets.already} already set, ${tickets.skipped} skipped, ${tickets.total} total\n`
  );

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
