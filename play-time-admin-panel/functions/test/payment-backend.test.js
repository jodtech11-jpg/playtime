'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  buildSingleEliminationBracket,
  membershipEndDate,
  normalizeVenueId,
  normalizedCheckoutTtlMinutes,
  paymentSignatureIsValid,
  productStatus,
  toPaise,
} = require('../payment-backend')._test;

test('toPaise accepts exact INR values', () => {
  assert.equal(toPaise(10), 1000);
  assert.equal(toPaise('99.95'), 9995);
  assert.throws(() => toPaise(1.001), /two decimal places/);
  assert.throws(() => toPaise(0), /positive amount/);
});

test('paymentSignatureIsValid verifies exact raw bytes', () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const secret = 'test-secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(paymentSignatureIsValid(body, signature, secret), true);
  assert.equal(paymentSignatureIsValid(Buffer.from('{}'), signature, secret), false);
  assert.equal(paymentSignatureIsValid(body, 'invalid', secret), false);
});

test('venue normalization preserves platform semantics', () => {
  assert.equal(normalizeVenueId(null), 'platform');
  assert.equal(normalizeVenueId(''), 'platform');
  assert.equal(normalizeVenueId(' platform '), 'platform');
  assert.equal(normalizeVenueId('venue-1'), 'venue-1');
});

test('inventory status uses configured reorder point', () => {
  assert.equal(productStatus(0, 5), 'Out of Stock');
  assert.equal(productStatus(5, 5), 'Low Stock');
  assert.equal(productStatus(6, 5), 'In Stock');
});

test('membership duration follows current plan labels', () => {
  const start = new Date('2026-01-15T00:00:00.000Z');
  assert.equal(membershipEndDate(start, 'Monthly').toISOString(), '2026-02-15T00:00:00.000Z');
  assert.equal(membershipEndDate(start, '6 Months').toISOString(), '2026-07-15T00:00:00.000Z');
  assert.equal(membershipEndDate(start, 'Annual').toISOString(), '2027-01-15T00:00:00.000Z');
});

test('stale checkout cleanup TTL is bounded and defaults safely', () => {
  assert.equal(normalizedCheckoutTtlMinutes(undefined), 30);
  assert.equal(normalizedCheckoutTtlMinutes('not-a-number'), 30);
  assert.equal(normalizedCheckoutTtlMinutes(1), 5);
  assert.equal(normalizedCheckoutTtlMinutes(42.6), 43);
  assert.equal(normalizedCheckoutTtlMinutes(999), 120);
});

test('single elimination bracket is deterministic and advances byes', () => {
  const teams = [
    {id: 'team-c', name: 'C'},
    {id: 'team-a', name: 'A'},
    {id: 'team-b', name: 'B'},
  ];
  const matches = buildSingleEliminationBracket('cup', teams);
  assert.equal(matches.length, 3);
  assert.equal(matches[0].teamAId, 'team-a');
  assert.equal(matches[0].teamBId, 'team-b');
  assert.equal(matches[1].teamAId, 'team-c');
  assert.equal(matches[1].status, 'Completed');
  assert.equal(matches[1].winnerId, 'team-c');
  assert.equal(matches[2].round, 'Finals');
});
