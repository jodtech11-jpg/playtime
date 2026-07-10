/**
 * CRUD E2E tests per role — exercises Firestore security rules with real user tokens.
 * Run: node scripts/crud-e2e-test.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = 'playtime-d9b83';
const BOSA_VENUE = 'VEN-1781938446805';
const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const apiKey = env.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();

const ACCOUNTS = {
  vendor: { email: 'testvendor.rbac@gmail.com', password: 'TestVendor123!' },
  custom: { email: 'test.custom.rbac@gmail.com', password: 'TestCustom123!' },
  superAdmin: { email: 'test.superadmin.rbac@gmail.com', password: 'TestAdmin123!' },
  player: { email: 'test.player.rbac@gmail.com', password: 'TestPlayer123!' },
};

const sa = JSON.parse(
  readFileSync(join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json'), 'utf8')
);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT });
}
const db = admin.firestore();

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) }
  );
  return res.json();
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (v instanceof Date) fields[k] = { timestampValue: v.toISOString() };
    else if (v && v._seconds !== undefined) fields[k] = { timestampValue: new Date(v._seconds * 1000).toISOString() };
    else if (typeof v === 'object') fields[k] = { mapValue: { fields: toFields(v) } };
  }
  return fields;
}

async function firestoreCreate(token, collection, data) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(data) }),
    }
  );
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body, name: body.name };
}

async function firestoreDelete(token, docPath) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/${docPath}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  return { ok: res.ok, status: res.status };
}

// Resolve a Bosa court for booking tests
const courtsSnap = await db.collection('courts').where('venueId', '==', BOSA_VENUE).where('status', '==', 'Active').limit(1).get();
const bosaCourt = courtsSnap.docs[0]?.data();
const bosaCourtId = courtsSnap.docs[0]?.id;

const ts = Date.now();
const results = { tag: `E2E-CRUD-${ts}`, bosaCourtId, roles: {} };
const cleanup = [];

for (const [label, creds] of Object.entries(ACCOUNTS)) {
  const auth = await signIn(creds.email, creds.password);
  const roleResult = { uid: auth.localId, authOk: !!auth.idToken, crud: {} };
  if (!auth.idToken) {
    roleResult.error = auth.error?.message;
    results.roles[label] = roleResult;
    continue;
  }

  const userDoc = (await db.collection('users').doc(auth.localId).get()).data();
  roleResult.role = userDoc?.role;
  roleResult.managedVenues = userDoc?.managedVenues || [];

  const tag = `${label}-${ts}`;

  // --- STAFF CREATE ---
  const staffPayload = {
    name: `${tag} Staff`,
    email: `${tag}@test.com`,
    phone: '9876543210',
    role: 'Coach',
    department: 'E2E',
    salary: 20000,
    status: 'Active',
    venueId: BOSA_VENUE,
  };
  const staffRes = await firestoreCreate(auth.idToken, 'staff', staffPayload);
  roleResult.crud.staff = {
    expected: label !== 'player',
    pass: label === 'player' ? !staffRes.ok : staffRes.ok,
    status: staffRes.status,
    error: staffRes.body?.error?.message,
  };
  if (staffRes.ok && staffRes.name) cleanup.push({ token: auth.idToken, path: staffRes.name });

  // --- TOURNAMENT CREATE ---
  const now = new Date();
  const tournamentPayload = {
    name: `${tag} Cup`,
    description: 'E2E test tournament',
    sport: 'Badminton',
    sportId: 'badminton',
    venueId: BOSA_VENUE,
    vendorId: auth.localId,
    status: 'Draft',
    bracketType: 'Single Elimination',
    entryFee: 100,
    startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14),
    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15),
    registrationStartDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    registrationEndDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
  };
  const tournRes = await firestoreCreate(auth.idToken, 'tournaments', tournamentPayload);
  roleResult.crud.tournament = {
    expected: label !== 'player',
    pass: label === 'player' ? !tournRes.ok : tournRes.ok,
    status: tournRes.status,
    error: tournRes.body?.error?.message,
  };
  if (tournRes.ok && tournRes.name) cleanup.push({ token: auth.idToken, path: tournRes.name });

  // --- BOOKING CREATE ---
  if (bosaCourtId) {
    const bookingDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20, 10, 0, 0);
    const bookingPayload = {
      venueId: BOSA_VENUE,
      courtId: bosaCourtId,
      court: bosaCourt?.name || 'Court 1',
      sport: bosaCourt?.sport || 'Badminton',
      userId: auth.localId,
      user: `${tag} Guest`,
      date: bookingDate.toISOString().slice(0, 10),
      time: '10:00',
      startTime: bookingDate,
      endTime: new Date(bookingDate.getTime() + 3600000),
      duration: 1,
      status: 'Confirmed',
      amount: 500,
      paymentStatus: 'Paid',
      paymentMethod: 'Cash',
    };
    const bookRes = await firestoreCreate(auth.idToken, 'bookings', bookingPayload);
    // Player can create own booking per rules (createdByCaller); vendor/admin too
    const bookingExpected = true; // all authenticated roles with venue access
    roleResult.crud.booking = {
      expected: bookingExpected,
      pass: bookRes.ok === bookingExpected,
      status: bookRes.status,
      error: bookRes.body?.error?.message,
    };
    if (bookRes.ok && bookRes.name) cleanup.push({ token: auth.idToken, path: bookRes.name });
  } else {
    roleResult.crud.booking = { skipped: true, reason: 'No active court at Bosa' };
  }

  // --- CROSS-VENUE DENIAL (vendor/custom only) ---
  if (label === 'vendor' || label === 'custom') {
    const otherVenues = await db.collection('venues').where('status', '==', 'Active').limit(5).get();
    const foreignVenue = otherVenues.docs.find((d) => d.id !== BOSA_VENUE);
    if (foreignVenue) {
      const denyRes = await firestoreCreate(auth.idToken, 'staff', {
        ...staffPayload,
        name: `${tag} Foreign Staff`,
        venueId: foreignVenue.id,
      });
      roleResult.crud.crossVenueDenied = {
        foreignVenue: foreignVenue.id,
        pass: !denyRes.ok,
        status: denyRes.status,
      };
    }
  }

  // --- ROLE DISPLAY NAME ---
  if (userDoc?.role) {
    const roleDoc = await db.collection('roles').doc(userDoc.role).get();
    const systemNames = { super_admin: 'Super Admin', venue_manager: 'Venue Manager', player: 'Player' };
    roleResult.displayName = roleDoc.exists
      ? roleDoc.data().name
      : systemNames[userDoc.role] || userDoc.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  results.roles[label] = roleResult;
}

// Cleanup test documents (use admin SDK — bypasses rules)
for (const item of cleanup) {
  try {
    const id = item.path.split('/').pop();
    const col = item.path.includes('/staff/') ? 'staff' : item.path.includes('/tournaments/') ? 'tournaments' : 'bookings';
    await db.collection(col).doc(id).delete();
  } catch (e) {
    results.cleanupErrors = results.cleanupErrors || [];
    results.cleanupErrors.push(e.message);
  }
}

// Summary
const summary = {};
for (const [label, r] of Object.entries(results.roles)) {
  const tests = r.crud || {};
  summary[label] = {
    role: r.role,
    displayName: r.displayName,
    staff: tests.staff?.pass,
    tournament: tests.tournament?.pass,
    booking: tests.booking?.pass ?? tests.booking?.skipped,
    crossVenueDenied: tests.crossVenueDenied?.pass ?? 'n/a',
  };
}
results.summary = summary;

console.log(JSON.stringify(results, null, 2));
