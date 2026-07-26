'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const createPaymentBackend = require('../payment-backend');
const {FakeFirestore, createAdmin} = require('./fake-firestore');

function createBackend(seed = {}, overrides = {}) {
  const db = new FakeFirestore(seed);
  const admin = createAdmin(db);
  const functions = {
    https: {onRequest: (handler) => handler},
    config: () => ({razorpay: {webhook_secret: 'webhook-secret'}}),
  };
  const backend = createPaymentBackend({
    admin,
    functions,
    applyCors: () => {},
    requireAuthenticatedPost: overrides.requireAuthenticatedPost ||
      (async () => ({uid: 'player-1'})),
    requireAdmin: overrides.requireAdmin ||
      (async () => ({
        uid: 'manager-1',
        isSuperAdmin: false,
        userData: {managedVenues: ['venue-a']},
      })),
    getRazorpayCredentials: () => ({keyId: 'key', keySecret: 'secret'}),
  });
  return {backend, db};
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test('authoritative order rejects another user and ignores client prices', async () => {
  const seed = {
    'orders/order-1': {
      userId: 'player-1',
      venueId: 'venue-a',
      status: 'Pending',
      paymentStatus: 'Pending',
      total: 1,
      items: [{productId: 'ball', quantity: 2, price: 0.01}],
    },
    'products/ball': {
      name: 'Ball',
      venueId: 'venue-a',
      price: 150,
      stock: 5,
      minStock: 2,
      status: 'In Stock',
    },
  };
  const {backend} = createBackend(seed);

  await assert.rejects(
    backend._test.authoritativeOrder('order-1', 'attacker'),
    /does not belong to this user/,
  );
  const order = await backend._test.authoritativeOrder('order-1', 'player-1');
  assert.equal(order.subtotalPaise, 30000);
  assert.equal(order.taxPaise, 5400);
  assert.equal(order.expectedAmountPaise, 35400);
  assert.equal(order.items[0].price, 150);
});

test('authoritative order combines duplicate quantities and enforces stock', async () => {
  const seed = {
    'orders/order-1': {
      userId: 'player-1',
      venueId: 'platform',
      status: 'Pending',
      paymentStatus: 'Pending',
      items: [
        {productId: 'ball', quantity: 2},
        {productId: 'ball', quantity: 2},
      ],
    },
    'products/ball': {
      name: 'Ball',
      price: 100,
      stock: 3,
      status: 'In Stock',
    },
  };
  const {backend} = createBackend(seed);
  await assert.rejects(
    backend._test.authoritativeOrder('order-1', 'player-1'),
    /Insufficient stock/,
  );
});

test('captured order fulfillment is idempotent and deducts stock once', async () => {
  const seed = {
    'orders/order-1': {
      userId: 'player-1',
      ownerId: 'player-1',
      venueId: 'venue-a',
      venueName: 'Arena',
      razorpayOrderId: 'order_rp',
      expectedAmountPaise: 23600,
      items: [{productId: 'ball', quantity: 2, price: 100}],
    },
    'products/ball': {
      name: 'Ball',
      stock: 5,
      minStock: 3,
      salesCount: 1,
      revenue: 100,
    },
    'appSettings/platform': {platformCommission: 5, gatewayFeeRate: 0.06},
  };
  const {backend, db} = createBackend(seed);
  const captured = {
    sourceType: 'Order',
    sourceId: 'order-1',
    paymentId: 'pay-1',
    razorpayOrderId: 'order_rp',
    amountPaise: 23600,
    currency: 'INR',
    event: 'payment.captured',
  };

  await backend._test.fulfillCapturedPayment(captured);
  await backend._test.fulfillCapturedPayment(captured);

  assert.equal(db.data('products/ball').stock, 3);
  assert.equal(db.data('products/ball').salesCount, 3);
  assert.equal(db.data('products/ball').revenue, 300);
  assert.equal(db.data('orders/order-1').status, 'Processing');
  assert.equal(db.data('payments/pay-1').status, 'Completed');
  assert.equal(db.data('settlements/razorpay_Order_order-1').status, 'Pending');
});

test('captured payment rejects amount and Razorpay order mismatches', async () => {
  const seed = {
    'bookings/booking-1': {
      userId: 'player-1',
      ownerId: 'player-1',
      venueId: 'venue-a',
      expectedAmountPaise: 10000,
      razorpayOrderId: 'expected-order',
    },
    'appSettings/platform': {},
  };
  const {backend} = createBackend(seed);
  const base = {
    sourceType: 'Booking',
    sourceId: 'booking-1',
    paymentId: 'pay-1',
    razorpayOrderId: 'expected-order',
    amountPaise: 10000,
    event: 'payment.captured',
  };

  await assert.rejects(
    backend._test.fulfillCapturedPayment({...base, amountPaise: 9999}),
    /does not match the expected amount/,
  );
  await assert.rejects(
    backend._test.fulfillCapturedPayment({...base, razorpayOrderId: 'wrong'}),
    /Razorpay order does not match/,
  );
});

test('wallet top-up is idempotent and validates amount and order', async () => {
  const seed = {
    'walletTopups/topup-1': {
      userId: 'player-1',
      amount: 500,
      expectedAmountPaise: 50000,
      razorpayOrderId: 'order_rp',
    },
    'users/player-1': {walletBalance: 100, walletBalancePaise: 10000},
  };
  const {backend, db} = createBackend(seed);
  const topup = {
    sourceId: 'topup-1',
    paymentId: 'pay-wallet',
    razorpayOrderId: 'order_rp',
    amountPaise: 50000,
    event: 'payment.captured',
  };

  await backend._test.fulfillWalletTopup(topup);
  await backend._test.fulfillWalletTopup(topup);
  assert.equal(db.data('users/player-1').walletBalancePaise, 60000);
  assert.equal(db.data('walletTransactions/pay-wallet').balanceAfterPaise, 60000);

  const {backend: invalidBackend} = createBackend(seed);
  await assert.rejects(
    invalidBackend._test.fulfillWalletTopup({...topup, amountPaise: 49999}),
    /verification failed/,
  );
});

test('poll voting records one vote and rejects repeats', async () => {
  const {backend, db} = createBackend({
    'polls/poll-1': {
      status: 'Active',
      options: [{id: 'yes', text: 'Yes', votes: 1}],
      totalVotes: 1,
      votedUserIds: [],
    },
  });

  const result = await backend._test.castVote('player-1', {
    pollId: 'poll-1',
    optionId: 'yes',
  });
  assert.equal(result.totalVotes, 2);
  assert.equal(db.data('polls/poll-1').options[0].votes, 2);
  await assert.rejects(
    backend._test.castVote('player-1', {pollId: 'poll-1', optionId: 'yes'}),
    /already voted/,
  );
});

test('settlement helper skips platform sales and calculates venue net', () => {
  const {backend, db} = createBackend();
  const transaction = {
    set: (ref, value, options) => db._set(ref, value, options),
  };
  backend._test.settlementWrites(
    transaction,
    'Order',
    'platform-order',
    {venueId: 'platform'},
    10000,
    new Date(),
  );
  assert.equal(db.data('settlements/razorpay_Order_platform-order'), undefined);

  backend._test.settlementWrites(
    transaction,
    'Booking',
    'booking-1',
    {venueId: 'venue-a', venueName: 'Arena', isFirstTimeBooking: true},
    100000,
    new Date(),
    {platformCommission: 10, convenienceFee: 100, gatewayFeeRate: 0.05},
  );
  assert.deepEqual(
    db.data('settlements/razorpay_Booking_booking-1').breakdown,
    {gross: 1000, commission: 100, convenienceFee: 100, gatewayFee: 5, net: 195},
  );
});

test('webhook rejects invalid signatures before database mutation', async () => {
  const {backend, db} = createBackend();
  const req = {
    method: 'POST',
    body: {event: 'payment.captured'},
    rawBody: Buffer.from('{"event":"payment.captured"}'),
    get: () => 'bad-signature',
  };
  const res = responseRecorder();
  await backend.razorpayWebhook(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Invalid signature/);
  assert.equal(db._documents.size, 0);
});

test('refund endpoint enforces venue authorization without provider calls', async () => {
  const {backend} = createBackend({
    'payments/pay-1': {
      status: 'Completed',
      paymentGateway: 'Razorpay',
      transactionId: 'pay_rp',
      venueId: 'venue-b',
      amount: 100,
      sourceType: 'Order',
      sourceId: 'order-1',
    },
  });
  const originalFetch = global.fetch;
  let providerCalled = false;
  global.fetch = async () => {
    providerCalled = true;
    throw new Error('unexpected provider call');
  };
  try {
    const res = responseRecorder();
    await backend.createRazorpayRefund({
      method: 'POST',
      body: {paymentId: 'pay-1', amountPaise: 1000, reason: 'Customer request'},
    }, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /outside your managed venues/);
    assert.equal(providerCalled, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('valid webhook signature fulfills once through the HTTP boundary', async () => {
  const body = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay-1',
          order_id: 'order_rp',
          amount: 10000,
          currency: 'INR',
          notes: {bookingId: 'booking-1'},
        },
      },
    },
  };
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', 'webhook-secret')
    .update(rawBody)
    .digest('hex');
  const {backend, db} = createBackend({
    'bookings/booking-1': {
      userId: 'player-1',
      ownerId: 'player-1',
      venueId: 'platform',
      expectedAmountPaise: 10000,
      razorpayOrderId: 'order_rp',
    },
    'appSettings/platform': {},
  });
  const req = {method: 'POST', body, rawBody, get: () => signature};

  const first = responseRecorder();
  await backend.razorpayWebhook(req, first);
  const second = responseRecorder();
  await backend.razorpayWebhook(req, second);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(db.data('bookings/booking-1').status, 'Confirmed');
  assert.equal(db.data('payments/pay-1').status, 'Completed');
});
