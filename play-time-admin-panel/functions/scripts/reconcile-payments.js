#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const admin = require('firebase-admin');

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split('=');
    return [key, value.join('=') || true];
  }),
);
const apply = args.has('--apply');
const projectId = args.get('--project') ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;
const confirmedProject = args.get('--confirm-project');

if (apply && (!projectId || confirmedProject !== projectId)) {
  console.error(
    'Apply mode requires --project=<id> and --confirm-project=<same-id>.',
  );
  process.exit(2);
}

admin.initializeApp(projectId ? {projectId} : undefined);
const db = admin.firestore();
const sourceCollections = {
  Booking: 'bookings',
  Membership: 'memberships',
  Order: 'orders',
};

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function paymentSource(payment) {
  const sourceType = payment.sourceType;
  const explicitId = payment.sourceId;
  if (sourceCollections[sourceType] && explicitId) {
    return {sourceType, sourceId: explicitId};
  }
  if (payment.bookingId) {
    return {sourceType: 'Booking', sourceId: payment.bookingId};
  }
  if (payment.membershipId) {
    return {sourceType: 'Membership', sourceId: payment.membershipId};
  }
  if (payment.orderId) {
    return {sourceType: 'Order', sourceId: payment.orderId};
  }
  return null;
}

function issueId(type, sourceType, sourceId) {
  return crypto
    .createHash('sha256')
    .update(`${type}:${sourceType}:${sourceId}`)
    .digest('hex')
    .slice(0, 40);
}

async function commitWrites(writes) {
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = db.batch();
    writes.slice(offset, offset + 450).forEach(({ref, data}) => {
      batch.set(ref, data, {merge: true});
    });
    await batch.commit();
  }
}

async function main() {
  const [paymentSnapshot, ...sourceSnapshots] = await Promise.all([
    db.collection('payments').get(),
    ...Object.values(sourceCollections).map((collection) =>
      db.collection(collection).get()),
  ]);
  const paymentsBySource = new Map();
  const paymentsByGatewayId = new Map();

  paymentSnapshot.docs.forEach((document) => {
    const payment = document.data();
    const source = paymentSource(payment);
    if (source) {
      const key = `${source.sourceType}:${source.sourceId}`;
      paymentsBySource.set(key, [
        ...(paymentsBySource.get(key) || []),
        {id: document.id, ref: document.ref, data: payment},
      ]);
    }
    const gatewayId = payment.razorpayPaymentId ||
      payment.paymentTransactionId ||
      payment.transactionId;
    if (gatewayId) {
      paymentsByGatewayId.set(gatewayId, [
        ...(paymentsByGatewayId.get(gatewayId) || []),
        document.id,
      ]);
    }
  });

  const findings = [];
  const safeBackfills = [];
  sourceSnapshots.forEach((snapshot, index) => {
    const sourceType = Object.keys(sourceCollections)[index];
    snapshot.docs.forEach((document) => {
      const source = document.data();
      const paid = source.paymentStatus === 'Paid' ||
        (sourceType === 'Membership' && source.status === 'Active');
      if (!paid) return;
      const key = `${sourceType}:${document.id}`;
      const linkedPayments = paymentsBySource.get(key) || [];
      if (linkedPayments.length === 0) {
        findings.push({
          type: 'missing-payment-ledger',
          sourceType,
          sourceId: document.id,
          detail: 'Paid source has no linked payment ledger.',
        });
      }
      if (sourceType === 'Order' && !source.inventoryDeductedAt) {
        findings.push({
          type: 'paid-order-inventory-unverified',
          sourceType,
          sourceId: document.id,
          detail: 'Paid order lacks inventoryDeductedAt; manual stock review required.',
        });
      }
      if (!source.webhookVerifiedAt) {
        const verifiedPayment = linkedPayments.find(
          ({data}) => asDate(data.webhookVerifiedAt),
        );
        if (verifiedPayment) {
          safeBackfills.push({
            ref: document.ref,
            data: {
              webhookVerifiedAt: verifiedPayment.data.webhookVerifiedAt,
              reconciliationBackfilledAt:
                admin.firestore.FieldValue.serverTimestamp(),
            },
          });
        } else {
          findings.push({
            type: 'missing-webhook-verification',
            sourceType,
            sourceId: document.id,
            detail: 'Paid source has no provable webhook verification timestamp.',
          });
        }
      }
    });
  });

  paymentsBySource.forEach((payments, key) => {
    if (payments.length < 2) return;
    const [sourceType, sourceId] = key.split(':');
    findings.push({
      type: 'duplicate-source-ledger',
      sourceType,
      sourceId,
      detail: `Multiple payment records: ${payments.map(({id}) => id).join(', ')}`,
    });
  });
  paymentsByGatewayId.forEach((paymentIds, gatewayId) => {
    if (paymentIds.length < 2) return;
    findings.push({
      type: 'duplicate-gateway-ledger',
      sourceType: 'Payment',
      sourceId: gatewayId,
      detail: `Gateway payment appears in: ${paymentIds.join(', ')}`,
    });
  });
  paymentSnapshot.docs.forEach((document) => {
    const payment = document.data();
    if (payment.status !== 'Completed' || payment.webhookVerifiedAt) return;
    findings.push({
      type: 'ledger-missing-webhook-verification',
      sourceType: 'Payment',
      sourceId: document.id,
      detail: 'Completed payment ledger lacks webhookVerifiedAt.',
    });
  });

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    projectId: projectId || '(application default)',
    scanned: {
      payments: paymentSnapshot.size,
      bookings: sourceSnapshots[0].size,
      memberships: sourceSnapshots[1].size,
      orders: sourceSnapshots[2].size,
    },
    findings,
    safeBackfills: safeBackfills.length,
  }, null, 2));

  if (!apply) return;
  const issueRefs = findings.map((finding) =>
    db.collection('reconciliationIssues').doc(
      issueId(finding.type, finding.sourceType, finding.sourceId),
    ));
  const existingIssues = issueRefs.length ?
    await db.getAll(...issueRefs) :
    [];
  const issueWrites = findings.map((finding, index) => ({
    ref: issueRefs[index],
    data: {
      ...finding,
      lastDetectedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(!existingIssues[index].exists ? {
        status: 'Open',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      } : {}),
    },
  }));
  await commitWrites([...safeBackfills, ...issueWrites]);
  console.log(
    `Applied ${safeBackfills.length} safe backfills and recorded ` +
    `${issueWrites.length} review issues.`,
  );
}

main().catch((error) => {
  console.error('Reconciliation failed:', error.message);
  process.exitCode = 1;
});
