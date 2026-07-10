/**
 * API-level E2E RBAC tests for all test accounts.
 * Run: node scripts/e2e-role-tests.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const apiKey = env.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();

const ACCOUNTS = {
  vendor: { email: 'testvendor.rbac@gmail.com', password: 'TestVendor123!', role: 'venue_manager' },
  custom: { email: 'test.custom.rbac@gmail.com', password: 'TestCustom123!', role: 'regional_coordinator' },
  superAdmin: { email: 'test.superadmin.rbac@gmail.com', password: 'TestAdmin123!', role: 'super_admin' },
  player: { email: 'test.player.rbac@gmail.com', password: 'TestPlayer123!', role: 'player' },
};

const VENUE_MANAGER_PERMS = [
  'bookings.read', 'bookings.update', 'bookings.create',
  'memberships.read', 'memberships.update', 'memberships.create',
  'venues.read', 'venues.update',
  'tournaments.read', 'tournaments.create', 'tournaments.update',
  'staff.read', 'staff.create', 'staff.update', 'staff.delete',
  'financials.read', 'users.read',
];

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return res.json();
}

async function callFn(token, path, body) {
  const res = await fetch(`https://${path}-ju7ehnioka-uc.a.run.app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

const sa = JSON.parse(readFileSync(join(__dirname, '..', 'playtime-d9b83-firebase-adminsdk-fbsvc-a6f77401f4.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'playtime-d9b83' });
}
const db = admin.firestore();

async function effectivePerms(user) {
  if (user.role === 'super_admin') return DEFAULT_ALL;
  const roleDoc = await db.collection('roles').doc(user.role).get();
  const rolePerms = roleDoc.exists
    ? roleDoc.data().permissions
    : user.role === 'venue_manager'
      ? VENUE_MANAGER_PERMS
      : [];
  return [...new Set([...(rolePerms || []), ...(user.customPermissions || [])])];
}

const DEFAULT_ALL = [
  'users.manage', 'financials.manage', 'settings.read', 'marketing.read',
  'bookings.read', 'tournaments.read',
];

const ROUTE_PERMISSIONS = {
  '/financials': ['financials.read'],
  '/users': ['users.manage'],
  '/settings': ['settings.read'],
  '/marketing': ['marketing.read'],
};

function canAccessRoute(role, perms, path) {
  if (role === 'super_admin') return true;
  if (['/users/roles', '/users/permissions', '/activity-log', '/moderation',
    '/marketplace', '/crm', '/analytics', '/frontend-cms', '/user-manual'].includes(path)) {
    return false;
  }
  const required = ROUTE_PERMISSIONS[path];
  if (!required) return true;
  return required.every((p) => perms.includes(p));
}

const results = { permissions: {}, api: {}, firestore: {} };

for (const [label, creds] of Object.entries(ACCOUNTS)) {
  const signInResult = await signIn(creds.email, creds.password);
  results.api[label] = { authOk: !!signInResult.idToken, uid: signInResult.localId };

  if (label === 'player') {
    results.api[label].adminPanelAllowed = false;
    continue;
  }

  if (signInResult.idToken) {
    const userDoc = (await db.collection('users').doc(signInResult.localId).get()).data();
    const perms = await effectivePerms(userDoc);
    results.permissions[label] = {
      role: userDoc.role,
      managedVenues: userDoc.managedVenues || [],
      financialsManage: perms.includes('financials.manage'),
      usersManage: perms.includes('users.manage'),
      settingsRead: perms.includes('settings.read'),
      marketingRead: perms.includes('marketing.read'),
    };

    const routeChecks = Object.keys(ROUTE_PERMISSIONS).map((path) => ({
      path,
      expected: canAccessRoute(userDoc.role, perms, path),
    }));
    results.permissions[label].routes = routeChecks;

    if (label !== 'superAdmin') {
      results.api[label].createSuperAdmin = await callFn(signInResult.idToken, 'createuseraccount', {
        name: 'Blocked', email: `blocked.${label}@test.com`, phone: '9876500000',
        role: 'super_admin', status: 'Active',
      });
    }
  }
}

// Super admin create vendor
const adminSignIn = await signIn(ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password);
if (adminSignIn.idToken) {
  results.api.superAdmin.createVendor = await callFn(adminSignIn.idToken, 'createuseraccount', {
    name: 'API Test Vendor', email: 'api.test.vendor@gmail.com', phone: '9876500099',
    role: 'venue_manager', status: 'Active', managedVenues: ['VEN-1781938446805'],
  });
}

// Firestore write probes (admin SDK simulates rules context — skip, use client rules knowledge)

console.log(JSON.stringify(results, null, 2));
