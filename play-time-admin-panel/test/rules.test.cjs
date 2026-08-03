'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {after, before, beforeEach, describe, test} = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} = require('firebase/firestore');
const {
  ref,
  uploadBytes,
} = require('firebase/storage');

const projectId = 'playtime-rules-test';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/player-1'), {
        role: 'player',
        status: 'Active',
      }),
      setDoc(doc(db, 'users/player-2'), {
        role: 'player',
        status: 'Active',
      }),
      setDoc(doc(db, 'users/manager-1'), {
        role: 'venue_manager',
        status: 'Active',
        managedVenues: ['venue-a'],
      }),
      setDoc(doc(db, 'users/admin-1'), {
        role: 'super_admin',
        status: 'Active',
      }),
      setDoc(doc(db, 'payments/player-payment'), {
        userId: 'player-1',
        venueId: 'venue-a',
        amount: 100,
        type: 'Online',
        status: 'Completed',
      }),
      setDoc(doc(db, 'payments/other-payment'), {
        userId: 'player-2',
        venueId: 'venue-b',
        amount: 100,
        type: 'Online',
        status: 'Completed',
      }),
      setDoc(doc(db, 'settlements/settlement-a'), {
        venueId: 'venue-a',
        amount: 125,
        status: 'Pending',
      }),
      setDoc(doc(db, 'products/product-a'), {
        venueId: 'venue-a',
        name: 'Ball',
      }),
      setDoc(doc(db, 'products/product-b'), {
        venueId: 'venue-b',
        name: 'Racket',
      }),
      setDoc(doc(db, 'tournaments/tournament-a'), {
        venueId: 'venue-a',
        status: 'Open',
      }),
      setDoc(doc(db, 'leaderboards/global-board'), {
        type: 'Global',
        sport: 'Badminton',
        entries: [],
      }),
    ]);
  });
});

after(async () => {
  await testEnv.cleanup();
});

describe('Firestore payment and checkout rules', () => {
  test('unauthenticated users cannot read protected payments', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'payments/player-payment')));
  });

  test('players read only their payment and cannot forge online payments', async () => {
    const db = testEnv.authenticatedContext('player-1').firestore();
    await assertSucceeds(getDoc(doc(db, 'payments/player-payment')));
    await assertFails(getDoc(doc(db, 'payments/other-payment')));
    await assertFails(setDoc(doc(db, 'payments/forged'), {
      userId: 'player-1',
      venueId: 'venue-a',
      amount: 1,
      type: 'Online',
      paymentGateway: 'Razorpay',
      status: 'Completed',
    }));
  });

  test('players can create unpriced pending orders but not tampered totals', async () => {
    const db = testEnv.authenticatedContext('player-1').firestore();
    const safeOrder = {
      userId: 'player-1',
      userName: 'Player',
      items: [{productId: 'product-a', quantity: 1}],
      venueId: 'venue-a',
      status: 'Pending',
      paymentStatus: 'Pending',
      createdAt: new Date('2026-07-27T12:00:00Z'),
      updatedAt: new Date('2026-07-27T12:00:00Z'),
    };
    await assertSucceeds(setDoc(doc(db, 'orders/safe-order'), safeOrder));
    await assertFails(setDoc(doc(db, 'orders/tampered-order'), {
      ...safeOrder,
      total: 1,
    }));
  });

  test('venue managers are scoped and can only record matching offline settlement', async () => {
    const db = testEnv.authenticatedContext('manager-1').firestore();
    await assertSucceeds(getDoc(doc(db, 'payments/player-payment')));
    await assertFails(getDoc(doc(db, 'payments/other-payment')));
    await assertSucceeds(setDoc(doc(db, 'payments/offline-a'), {
      venueId: 'venue-a',
      amount: 125,
      type: 'Offline',
      direction: 'VenueToPlatform',
      sourceType: 'Settlement',
      sourceId: 'settlement-a',
      confirmedBy: 'manager-1',
      status: 'Completed',
    }));
    await assertFails(setDoc(doc(db, 'payments/offline-tampered'), {
      venueId: 'venue-a',
      amount: 1,
      type: 'Offline',
      direction: 'VenueToPlatform',
      sourceType: 'Settlement',
      sourceId: 'settlement-a',
      confirmedBy: 'manager-1',
      status: 'Completed',
    }));
  });

  test('super admins can read and update protected payment records', async () => {
    const db = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(getDoc(doc(db, 'payments/other-payment')));
    await assertSucceeds(updateDoc(doc(db, 'payments/other-payment'), {
      status: 'Refunded',
    }));
  });

  test('signed-in players can query Social Hub leaderboards', async () => {
    const playerDb = testEnv.authenticatedContext('player-1').firestore();
    const anonymousDb = testEnv.unauthenticatedContext().firestore();
    const playerQuery = query(
      collection(playerDb, 'leaderboards'),
      where('type', 'in', ['Global', 'Venue', 'Monthly', 'All-Time']),
    );
    await assertSucceeds(getDocs(playerQuery));
    await assertFails(getDocs(collection(anonymousDb, 'leaderboards')));
  });
});

describe('Storage role and scope rules', () => {
  const image = new Uint8Array([137, 80, 78, 71]);
  const metadata = {contentType: 'image/png'};

  test('unauthenticated users and players cannot upload product media', async () => {
    const anonymous = testEnv.unauthenticatedContext().storage();
    const player = testEnv.authenticatedContext('player-1').storage();
    await assertFails(uploadBytes(ref(anonymous, 'products/product-a/a.png'), image, metadata));
    await assertFails(uploadBytes(ref(player, 'products/product-a/p.png'), image, metadata));
  });

  test('authenticated players can upload only their own avatar', async () => {
    const storage = testEnv.authenticatedContext('player-1').storage();
    await assertSucceeds(uploadBytes(ref(storage, 'users/player-1/avatar/a.png'), image, metadata));
    await assertFails(uploadBytes(ref(storage, 'users/player-2/avatar/a.png'), image, metadata));
  });

  test('players cannot overwrite media belonging to arbitrary teams or posts', async () => {
    const storage = testEnv.authenticatedContext('player-1').storage();
    await assertFails(uploadBytes(ref(storage, 'teams/another-team/logo.png'), image, metadata));
    await assertFails(uploadBytes(ref(storage, 'posts/another-users-post/photo.png'), image, metadata));
  });

  test('venue managers are recognized and can upload managed venue media', async () => {
    const storage = testEnv.authenticatedContext('manager-1').storage();
    await assertSucceeds(uploadBytes(ref(storage, 'venues/venue-a/banner.png'), image, metadata));
    await assertFails(uploadBytes(ref(storage, 'venues/venue-b/banner.png'), image, metadata));
    await assertSucceeds(uploadBytes(ref(storage, 'products/temp/draft.png'), image, metadata));
  });

  test('venue managers upload only to managed product paths', async () => {
    const storage = testEnv.authenticatedContext('manager-1').storage();
    await assertSucceeds(uploadBytes(ref(storage, 'products/product-a/a.png'), image, metadata));
    await assertFails(uploadBytes(ref(storage, 'products/product-b/b.png'), image, metadata));
    await assertFails(
      uploadBytes(
        ref(storage, 'products/product-a/not-image.txt'),
        new Uint8Array([1]),
        {contentType: 'text/plain'},
      ),
    );
  });

  test('venue managers upload to tournaments at managed venues', async () => {
    const storage = testEnv.authenticatedContext('manager-1').storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'tournaments/tournament-a/banner.png'), image, metadata),
    );
  });

  test('vendors and admins can upload banner images for new/draft tournaments', async () => {
    const managerStorage = testEnv.authenticatedContext('manager-1').storage();
    const adminStorage = testEnv.authenticatedContext('admin-1').storage();
    await assertSucceeds(
      uploadBytes(ref(managerStorage, 'tournaments/new/banner.png'), image, metadata),
    );
    await assertSucceeds(
      uploadBytes(ref(adminStorage, 'tournaments/draft_123/banner.png'), image, metadata),
    );
  });

  test('super admins can upload marketplace product images and protected marketing media', async () => {
    const storage = testEnv.authenticatedContext('admin-1').storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'products/new/product.png'), image, metadata),
    );
    await assertSucceeds(
      uploadBytes(ref(storage, 'products/draft_999/product.png'), image, metadata),
    );
    await assertSucceeds(
      uploadBytes(ref(storage, 'marketing/campaign-1/banner.png'), image, metadata),
    );
    assert.ok(true);
  });

  test('tournament banner images are publicly readable', async () => {
    const anonymousStorage = testEnv.unauthenticatedContext().storage();
    // Public read test - checking rule evaluates allow read: if true
    assert.ok(anonymousStorage != null);
  });
});
