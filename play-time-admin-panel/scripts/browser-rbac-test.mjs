/**
 * Helper: sign in via Firebase REST and return idToken (for API tests).
 * Browser tests are run separately via MCP.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
const apiKey = env.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();

export async function signIn(email, password) {
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

export async function testCreateUserAs(token, payload) {
  const res = await fetch('https://createuseraccount-ju7ehnioka-uc.a.run.app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.text() };
}

const ACCOUNTS = {
  vendor: { email: 'testvendor.rbac@gmail.com', password: 'TestVendor123!' },
  custom: { email: 'test.custom.rbac@gmail.com', password: 'TestCustom123!' },
  superAdmin: { email: 'test.superadmin.rbac@gmail.com', password: 'TestAdmin123!' },
};

async function main() {
  const results = {};

  for (const [label, creds] of Object.entries(ACCOUNTS)) {
    const signInResult = await signIn(creds.email, creds.password);
    results[label] = {
      authOk: !!signInResult.idToken,
      uid: signInResult.localId,
      error: signInResult.error?.message,
    };

    if (signInResult.idToken && label !== 'superAdmin') {
      results[label].createSuperAdmin = await testCreateUserAs(signInResult.idToken, {
        name: 'Blocked Admin',
        email: `blocked.${label}@gmail.com`,
        phone: '9876500000',
        role: 'super_admin',
        status: 'Active',
      });
    }
  }

  // Super admin CAN create venue_manager
  const admin = await signIn(ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.password);
  if (admin.idToken) {
    results.superAdmin.createVendor = await testCreateUserAs(admin.idToken, {
      name: 'Temp Vendor',
      email: 'temp.vendor.rbac@gmail.com',
      phone: '9876500001',
      role: 'venue_manager',
      status: 'Active',
      managedVenues: ['VEN-1781938446805'],
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
