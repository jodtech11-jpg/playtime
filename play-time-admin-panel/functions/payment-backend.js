'use strict';

const crypto = require('crypto');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');

const SOURCE_CONFIG = {
  Booking: {collection: 'bookings', idNote: 'bookingId'},
  Membership: {collection: 'memberships', idNote: 'membershipId'},
  Order: {collection: 'orders', idNote: 'orderId'},
  Wallet: {collection: 'walletTopups', idNote: 'walletTopupId'},
};

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function httpError(message, status = 400) {
  return Object.assign(new Error(message), {status});
}

function toPaise(value, field = 'amount') {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw httpError(`${field} must be a positive amount`);
  }
  const paise = Math.round(number * 100);
  if (Math.abs(number * 100 - paise) > 0.001) {
    throw httpError(`${field} cannot have more than two decimal places`);
  }
  return paise;
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeVenueId(value) {
  const venueId = cleanString(value);
  return !venueId || venueId === 'platform' ? 'platform' : venueId;
}

function safeDocumentId(value, field) {
  const id = cleanString(value);
  if (!id || id.length > 150 || id.includes('/')) {
    throw httpError(`${field} is invalid`);
  }
  return id;
}

function paymentSignatureIsValid(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody)) rawBody = Buffer.from(String(rawBody || ''), 'utf8');
  if (!cleanString(signature) || !cleanString(secret)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'hex');
  } catch (_) {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function productStatus(stock, minStock) {
  if (stock <= 0) return 'Out of Stock';
  return stock <= Math.max(0, Number(minStock || 10)) ? 'Low Stock' : 'In Stock';
}

function membershipEndDate(startDate, planType) {
  const end = new Date(startDate.getTime());
  const normalized = String(planType || '').toLowerCase();
  if (normalized.includes('annual') || normalized.includes('year')) {
    end.setFullYear(end.getFullYear() + 1);
  } else if (normalized.includes('6')) {
    end.setMonth(end.getMonth() + 6);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

function normalizedCheckoutTtlMinutes(value) {
  const configured = Number(value);
  return Number.isFinite(configured) ?
    Math.min(120, Math.max(5, Math.round(configured))) :
    30;
}

function buildSingleEliminationBracket(tournamentId, teams) {
  const seeded = [...teams].sort((left, right) => left.id.localeCompare(right.id));
  if (seeded.length < 2) throw httpError('At least two eligible teams are required');
  const slotCount = 2 ** Math.ceil(Math.log2(seeded.length));
  const slots = [...seeded, ...Array(slotCount - seeded.length).fill(null)];
  const matches = [];
  let matchNumber = 1;
  for (
    let roundIndex = 0, matchesInRound = slotCount / 2;
    matchesInRound >= 1;
    roundIndex += 1, matchesInRound /= 2
  ) {
    const remainingTeams = slotCount / (2 ** roundIndex);
    const round = remainingTeams === 2 ? 'Finals' :
      (remainingTeams === 4 ? 'Semifinals' :
        (remainingTeams === 8 ? 'Quarterfinals' : `Round ${roundIndex + 1}`));
    const nextRoundStart = matchNumber + matchesInRound;
    for (let slot = 0; slot < matchesInRound; slot += 1) {
      const teamA = roundIndex === 0 ? slots[slot * 2] : null;
      const teamB = roundIndex === 0 ? slots[slot * 2 + 1] : null;
      const automaticWinner = roundIndex === 0 && Boolean(teamA) !== Boolean(teamB) ?
        (teamA || teamB) : null;
      matches.push({
        id: `${tournamentId}_r${roundIndex + 1}_m${slot + 1}`,
        tournamentId,
        round,
        matchNumber,
        teamAId: teamA?.id || '',
        teamAName: teamA?.name || (roundIndex === 0 ? 'BYE' : 'TBD'),
        teamBId: teamB?.id || '',
        teamBName: teamB?.name || (roundIndex === 0 ? 'BYE' : 'TBD'),
        bracketSlot: slot,
        nextMatchNumber: matchesInRound > 1 ?
          nextRoundStart + Math.floor(slot / 2) : null,
        status: automaticWinner ? 'Completed' : 'Scheduled',
        winnerId: automaticWinner?.id || null,
        winnerName: automaticWinner?.name || null,
      });
      matchNumber += 1;
    }
  }
  return matches;
}

module.exports = function createPaymentBackend({
  admin,
  functions,
  applyCors,
  requireAuthenticatedPost,
  requireAdmin,
  getRazorpayCredentials,
}) {
  const db = admin.firestore();
  const now = () => admin.firestore.FieldValue.serverTimestamp();

  async function requireAdminPost(req, res, superAdminOnly = false) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return null;
    }
    if (req.method !== 'POST') {
      res.status(405).json({error: 'Method not allowed. Use POST.'});
      return null;
    }
    const auth = await requireAdmin(req, res);
    if (!auth) return null;
    if (superAdminOnly && !auth.isSuperAdmin) {
      res.status(403).json({error: 'Only super admins may perform this action'});
      return null;
    }
    return auth;
  }

  async function createRazorpayOrder({amountPaise, receipt, notes}) {
    const {keyId, keySecret} = getRazorpayCredentials();
    if (!keyId || !keySecret) throw httpError('Razorpay is not configured', 503);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: receipt.slice(0, 40),
        notes,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.id) {
      throw httpError(body.error?.description || 'Razorpay order creation failed', 502);
    }
    return {order: body, keyId};
  }

  async function courtForBooking(booking) {
    const courtId = safeDocumentId(booking.courtId, 'booking courtId');
    const venueId = safeDocumentId(booking.venueId, 'booking venueId');
    const [courtSnapshot, venueSnapshot] = await Promise.all([
      db.collection('courts').doc(courtId).get(),
      db.collection('venues').doc(venueId).get(),
    ]);
    if (!venueSnapshot.exists) throw httpError('Booking venue not found', 409);
    let court = courtSnapshot.exists ? courtSnapshot.data() : null;
    if (!court || normalizeVenueId(court.venueId) !== venueId) {
      const courts = Array.isArray(venueSnapshot.data().courts) ? venueSnapshot.data().courts : [];
      court = courts.find((entry) => String(entry.id) === courtId) || null;
    }
    if (!court || court.status && court.status !== 'Active') {
      throw httpError('Booking court is unavailable', 409);
    }
    return {court, venue: venueSnapshot.data(), venueId};
  }

  async function authoritativeBooking(bookingId, uid) {
    const ref = db.collection('bookings').doc(safeDocumentId(bookingId, 'bookingId'));
    const snapshot = await ref.get();
    if (!snapshot.exists) throw httpError('Booking not found', 404);
    const booking = snapshot.data();
    if (booking.userId !== uid) throw httpError('Booking does not belong to this user', 403);
    if (booking.paymentStatus === 'Paid' || booking.status === 'Confirmed') {
      throw httpError('Booking is already paid or confirmed', 409);
    }
    if (booking.paymentStatus === 'Pending' && cleanString(booking.razorpayOrderId)) {
      throw httpError('Booking already has a pending Razorpay order', 409);
    }
    if (!['Pending', 'Payment Pending'].includes(booking.status)) {
      throw httpError('Booking is not pending payment', 409);
    }
    const start = asDate(booking.startTime);
    const end = asDate(booking.endTime);
    if (!start || !end || end <= start || start <= new Date()) {
      throw httpError('Booking time is invalid or has passed', 409);
    }
    const overlappingSnapshot = await db.collection('bookings')
      .where('venueId', '==', booking.venueId)
      .where('courtId', '==', booking.courtId)
      .get();
    const createdAt = asDate(booking.createdAt);
    const hasOverlap = overlappingSnapshot.docs.some((candidate) => {
      if (candidate.id === ref.id) return false;
      const data = candidate.data();
      if (!['Pending', 'Confirmed', 'Processing'].includes(data.status)) return false;
      const candidateStart = asDate(data.startTime);
      const candidateEnd = asDate(data.endTime);
      const overlaps = candidateStart && candidateEnd &&
        candidateStart < end &&
        candidateEnd > start;
      if (!overlaps) return false;
      const candidateCreatedAt = asDate(data.createdAt);
      if (createdAt && candidateCreatedAt) {
        if (candidateCreatedAt < createdAt) return true;
        if (candidateCreatedAt > createdAt) return false;
      }
      return candidate.id < ref.id;
    });
    if (hasOverlap) {
      throw httpError('This time slot was just booked. Please select another slot', 409);
    }
    const {court, venue, venueId} = await courtForBooking(booking);
    const hours = (end.getTime() - start.getTime()) / 3600000;
    const expectedAmountPaise = toPaise(Number(court.pricePerHour) * hours);
    return {ref, data: booking, venue, venueId, expectedAmountPaise};
  }

  async function authoritativeMembership(membershipId, uid) {
    const ref = db.collection('memberships')
      .doc(safeDocumentId(membershipId, 'membershipId'));
    const membershipSnapshot = await ref.get();
    if (!membershipSnapshot.exists) throw httpError('Membership not found', 404);
    const membership = membershipSnapshot.data();
    if (membership.userId !== uid) throw httpError('Membership does not belong to this user', 403);
    if (membership.paymentStatus === 'Paid' || membership.status === 'Active') {
      throw httpError('Membership is already active or paid', 409);
    }
    if (membership.paymentStatus === 'Pending' &&
        cleanString(membership.razorpayOrderId)) {
      throw httpError('Membership already has a pending Razorpay order', 409);
    }
    if (!['Pending', 'Payment Pending'].includes(membership.status)) {
      throw httpError('Membership is not pending payment', 409);
    }
    const planId = safeDocumentId(membership.planId, 'membership planId');
    const planSnapshot = await db.collection('membershipPlans').doc(planId).get();
    if (!planSnapshot.exists || planSnapshot.data().isActive === false) {
      throw httpError('Membership plan is unavailable', 409);
    }
    const plan = planSnapshot.data();
    const planVenue = normalizeVenueId(plan.venueId);
    const membershipVenue = normalizeVenueId(membership.venueId);
    if (planVenue !== membershipVenue) throw httpError('Membership plan venue mismatch', 409);
    const expectedAmountPaise = toPaise(plan.price, 'membership plan price');
    return {ref, data: membership, plan, venueId: planVenue, expectedAmountPaise};
  }

  async function authoritativeOrder(orderId, uid) {
    const ref = db.collection('orders').doc(safeDocumentId(orderId, 'orderId'));
    const orderSnapshot = await ref.get();
    if (!orderSnapshot.exists) throw httpError('Order not found', 404);
    const order = orderSnapshot.data();
    if (order.userId !== uid) throw httpError('Order does not belong to this user', 403);
    if (order.paymentStatus === 'Paid' || order.status === 'Processing') {
      throw httpError('Order is already paid or processing', 409);
    }
    if (order.paymentStatus === 'Pending' && cleanString(order.razorpayOrderId)) {
      throw httpError('Order already has a pending Razorpay order', 409);
    }
    if (order.status !== 'Pending' || order.paymentStatus !== 'Pending') {
      throw httpError('Order is not pending payment', 409);
    }
    if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 100) {
      throw httpError('Order items are invalid', 409);
    }
    const quantities = new Map();
    for (const item of order.items) {
      const productId = safeDocumentId(item.productId, 'productId');
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        throw httpError('Product quantity is invalid', 409);
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    const productRefs = [...quantities.keys()].map((id) => db.collection('products').doc(id));
    const productSnapshots = await db.getAll(...productRefs);
    const venueId = normalizeVenueId(order.venueId);
    let subtotalPaise = 0;
    const items = productSnapshots.map((snapshot) => {
      if (!snapshot.exists) throw httpError(`Product not found: ${snapshot.id}`, 409);
      const product = snapshot.data();
      const productVenue = normalizeVenueId(product.venueId);
      if (productVenue !== venueId) throw httpError('Order contains products from another venue', 409);
      const quantity = quantities.get(snapshot.id);
      const stock = Number(product.stock);
      if (product.status === 'Out of Stock' ||
          !Number.isInteger(stock) ||
          stock < quantity) {
        throw httpError(`Insufficient stock for ${product.name || snapshot.id}`, 409);
      }
      const pricePaise = toPaise(product.price, 'product price');
      subtotalPaise += pricePaise * quantity;
      return {
        productId: snapshot.id,
        productName: cleanString(product.name) || snapshot.id,
        quantity,
        price: pricePaise / 100,
        image: Array.isArray(product.images) && product.images.length ? product.images[0] : null,
      };
    });
    // Current marketplace pricing is 18% tax and free shipping. Discounts are
    // deliberately excluded until a server-side promotion collection exists.
    const taxPaise = Math.round(subtotalPaise * 0.18);
    const expectedAmountPaise = subtotalPaise + taxPaise;
    return {
      ref,
      data: order,
      venueId,
      items,
      subtotalPaise,
      taxPaise,
      expectedAmountPaise,
    };
  }

  async function persistPendingOrder(sourceType, source, auth, razorpay) {
    const timestamp = now();
    const update = {
      userId: auth.uid,
      ownerId: auth.uid,
      expectedAmountPaise: source.expectedAmountPaise,
      razorpayOrderId: razorpay.order.id,
      paymentStatus: 'Pending',
      paymentMethod: 'Online',
      paymentGateway: 'Razorpay',
      paymentOrderCreatedAt: timestamp,
      updatedAt: timestamp,
    };
    if (sourceType === 'Booking') {
      update.amount = source.expectedAmountPaise / 100;
    } else if (sourceType === 'Membership') {
      update.price = source.expectedAmountPaise / 100;
      update.planName = source.plan.name || source.data.planName || '';
      update.planType = source.plan.type || source.plan.planType || source.data.planType || 'Monthly';
    } else if (sourceType === 'Order') {
      Object.assign(update, {
        items: source.items,
        subtotal: source.subtotalPaise / 100,
        discount: 0,
        shippingCost: 0,
        tax: source.taxPaise / 100,
        total: source.expectedAmountPaise / 100,
      });
    }
    await source.ref.set(update, {merge: true});
    return {
      sourceId: source.ref.id,
      orderId: razorpay.order.id,
      razorpayOrderId: razorpay.order.id,
      keyId: razorpay.keyId,
      amount: source.expectedAmountPaise / 100,
      amountPaise: source.expectedAmountPaise,
      expectedAmountPaise: source.expectedAmountPaise,
      currency: 'INR',
      venueId: source.venueId,
    };
  }

  function orderEndpoint(sourceType, loader) {
    return functions.https.onRequest(async (req, res) => {
      const auth = await requireAuthenticatedPost(req, res);
      if (!auth) return;
      try {
        const config = SOURCE_CONFIG[sourceType];
        const sourceId = req.body && req.body[config.idNote];
        const source = await loader(sourceId, auth.uid);
        const notes = {
          [config.idNote]: source.ref.id,
          sourceType,
          sourceId: source.ref.id,
          userId: auth.uid,
          venueId: source.venueId,
        };
        const razorpay = await createRazorpayOrder({
          amountPaise: source.expectedAmountPaise,
          receipt: `${sourceType.toLowerCase()}_${source.ref.id}`,
          notes,
        });
        const result = await persistPendingOrder(sourceType, source, auth, razorpay);
        res.status(201).json(result);
      } catch (error) {
        console.error(`create${sourceType}PaymentOrder failed:`, error);
        res.status(error.status || 500).json({error: error.message || 'Could not create payment order'});
      }
    });
  }

  const createBookingPaymentOrder = orderEndpoint('Booking', authoritativeBooking);
  const createMembershipPaymentOrder = orderEndpoint('Membership', authoritativeMembership);
  const createMarketplacePaymentOrder = orderEndpoint('Order', authoritativeOrder);

  function settlementWrites(
    transaction,
    sourceType,
    sourceId,
    source,
    amountPaise,
    timestamp,
    settings = {},
  ) {
    const venueId = normalizeVenueId(source.venueId);
    if (venueId === 'platform') return;
    const settlementRef = db.collection('settlements').doc(`razorpay_${sourceType}_${sourceId}`);
    const invoiceRef = db.collection('invoices').doc(`razorpay_${sourceType}_${sourceId}`);
    const commissionSetting = Number(settings.platformCommission);
    const commissionRate = commissionSetting > 1 ? commissionSetting / 100 :
      (commissionSetting > 0 ? commissionSetting : 0.05);
    const gross = amountPaise / 100;
    const commission = Math.round(gross * commissionRate * 100) / 100;
    const convenienceFee = sourceType === 'Booking' && source.isFirstTimeBooking ?
      Number(settings.convenienceFee || 100) : 0;
    const gatewayFeeRate = Number(settings.gatewayFeeRate || 0.06);
    const gatewayFee = Math.round(commission * gatewayFeeRate * 100) / 100;
    const net = Math.round((commission + convenienceFee - gatewayFee) * 100) / 100;
    const dueDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    const venueName = cleanString(source.venueName) || cleanString(source.venue) || 'Venue';
    const invoiceNumber = `INV-RP-${sourceType.slice(0, 3).toUpperCase()}-${sourceId}`;
    const breakdown = {gross, commission, convenienceFee, gatewayFee, net};
    transaction.set(invoiceRef, {
      invoiceNumber,
      venueId,
      venueName,
      source: venueName,
      sourceId,
      type: sourceType,
      amount: net,
      breakdown,
      status: 'Sent',
      dueDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, {merge: true});
    transaction.set(settlementRef, {
      venueId,
      venueName,
      sourceType,
      sourceId,
      invoiceId: invoiceRef.id,
      invoiceNumber,
      amount: net,
      breakdown,
      status: 'Pending',
      dueDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, {merge: true});
  }

  async function fulfillCapturedPayment({
    sourceType,
    sourceId,
    paymentId,
    razorpayOrderId,
    amountPaise,
    currency,
    event,
  }) {
    const config = SOURCE_CONFIG[sourceType];
    if (!config || !sourceId) throw httpError('Webhook source metadata is invalid', 409);
    const sourceRef = db.collection(config.collection).doc(sourceId);
    const paymentRef = db.collection('payments').doc(paymentId || `razorpay_order_${razorpayOrderId}`);
    const settingsSnapshot = await db.collection('appSettings').doc('platform').get();
    const settlementSettings = settingsSnapshot.data() || {};
    await db.runTransaction(async (transaction) => {
      const [sourceSnapshot, paymentSnapshot] = await Promise.all([
        transaction.get(sourceRef),
        transaction.get(paymentRef),
      ]);
      if (!sourceSnapshot.exists) throw httpError('Webhook source was not found', 409);
      const source = sourceSnapshot.data();
      if (paymentSnapshot.exists &&
          paymentSnapshot.data().status === 'Completed') {
        return;
      }
      const expectedAmountPaise = Number(source.expectedAmountPaise || 0);
      if (expectedAmountPaise > 0 && expectedAmountPaise !== amountPaise) {
        throw httpError('Webhook amount does not match the expected amount', 409);
      }
      if (cleanString(source.razorpayOrderId) &&
          source.razorpayOrderId !== razorpayOrderId) {
        throw httpError('Webhook Razorpay order does not match', 409);
      }
      if (source.userId && source.ownerId && source.userId !== source.ownerId) {
        throw httpError('Webhook source ownership is invalid', 409);
      }
      const timestamp = now();
      const update = {
        paymentStatus: 'Paid',
        paymentMethod: 'Online',
        paymentGateway: 'Razorpay',
        paymentTransactionId: paymentId,
        razorpayOrderId,
        webhookVerifiedAt: timestamp,
        updatedAt: timestamp,
      };
      if (sourceType === 'Booking') {
        update.status = 'Confirmed';
      } else if (sourceType === 'Membership') {
        update.status = 'Active';
        update.paymentDate = timestamp;
        if (!asDate(source.startDate)) update.startDate = timestamp;
        if (!asDate(source.endDate)) {
          update.endDate = admin.firestore.Timestamp.fromDate(
            membershipEndDate(new Date(), source.planType),
          );
        }
      } else if (sourceType === 'Order') {
        update.status = 'Processing';
        if (!source.inventoryDeductedAt) {
          const items = Array.isArray(source.items) ? source.items : [];
          const refs = items.map((item) =>
            db.collection('products').doc(safeDocumentId(item.productId, 'productId')));
          const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
          snapshots.forEach((snapshot, index) => {
            if (!snapshot.exists) throw httpError('Paid order product not found', 409);
            const product = snapshot.data();
            const quantity = Number(items[index].quantity);
            const stock = Number(product.stock);
            if (!Number.isInteger(quantity) || quantity <= 0 ||
                !Number.isInteger(stock) || stock < quantity) {
              throw httpError('Insufficient inventory for paid order', 409);
            }
            const newStock = stock - quantity;
            transaction.update(snapshot.ref, {
              stock: newStock,
              status: productStatus(newStock, product.minStock),
              salesCount: admin.firestore.FieldValue.increment(quantity),
              revenue: admin.firestore.FieldValue.increment(
                Number(items[index].price) * quantity,
              ),
              updatedAt: timestamp,
            });
          });
          update.inventoryDeductedAt = timestamp;
          update.inventoryPaymentId = paymentId;
        }
      } else if (sourceType === 'Wallet') {
        throw httpError('Wallet top-ups are handled by the legacy-compatible wallet path', 409);
      }
      transaction.set(sourceRef, update, {merge: true});
      transaction.set(paymentRef, {
        type: 'Online',
        direction: normalizeVenueId(source.venueId) === 'platform' ?
          'UserToPlatform' : 'UserToVenue',
        sourceType,
        sourceId,
        userId: source.userId || source.ownerId || null,
        venueId: normalizeVenueId(source.venueId),
        amount: amountPaise / 100,
        expectedAmountPaise: expectedAmountPaise || null,
        currency: currency || 'INR',
        paymentMethod: 'Razorpay',
        paymentGateway: 'Razorpay',
        transactionId: paymentId,
        razorpayOrderId,
        orderId: sourceType === 'Order' ? sourceId : null,
        bookingId: sourceType === 'Booking' ? sourceId : null,
        membershipId: sourceType === 'Membership' ? sourceId : null,
        status: 'Completed',
        paymentDate: timestamp,
        rawEvent: event,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {merge: true});
      settlementWrites(
        transaction,
        sourceType,
        sourceId,
        source,
        amountPaise,
        timestamp,
        settlementSettings,
      );
    });
  }

  async function fulfillWalletTopup({
    sourceId,
    paymentId,
    razorpayOrderId,
    amountPaise,
    currency,
    event,
  }) {
    const topupRef = db.collection('walletTopups').doc(sourceId);
    const paymentRef = db.collection('payments').doc(paymentId || `razorpay_order_${razorpayOrderId}`);
    await db.runTransaction(async (transaction) => {
      const [topupSnapshot, paymentSnapshot] = await Promise.all([
        transaction.get(topupRef),
        transaction.get(paymentRef),
      ]);
      if (!topupSnapshot.exists) throw httpError('Wallet top-up not found', 409);
      const topup = topupSnapshot.data();
      const expected = Number(topup.expectedAmountPaise || Number(topup.amount) * 100);
      if (expected !== amountPaise || topup.razorpayOrderId !== razorpayOrderId) {
        throw httpError('Wallet top-up verification failed', 409);
      }
      if (paymentSnapshot.exists &&
          paymentSnapshot.data().status === 'Completed') return;
      const userRef = db.collection('users').doc(topup.userId);
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) throw httpError('Wallet owner not found', 409);
      const currentPaise = Math.round(Number(userSnapshot.data().walletBalance || 0) * 100);
      const balanceAfterPaise = currentPaise + amountPaise;
      const timestamp = now();
      transaction.set(userRef, {
        walletBalance: balanceAfterPaise / 100,
        walletBalancePaise: balanceAfterPaise,
        updatedAt: timestamp,
      }, {merge: true});
      transaction.update(topupRef, {
        status: 'Completed',
        paymentTransactionId: paymentId,
        webhookVerifiedAt: timestamp,
        updatedAt: timestamp,
      });
      transaction.set(db.collection('walletTransactions').doc(paymentRef.id), {
        userId: topup.userId,
        type: 'Credit',
        amount: amountPaise / 100,
        amountPaise,
        balanceAfter: balanceAfterPaise / 100,
        balanceAfterPaise,
        description: 'Wallet top-up',
        paymentGateway: 'Razorpay',
        paymentTransactionId: paymentId,
        razorpayOrderId,
        status: 'Completed',
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {merge: true});
      transaction.set(paymentRef, {
        type: 'Online',
        direction: 'UserToPlatform',
        sourceType: 'Wallet',
        sourceId,
        walletTopupId: sourceId,
        userId: topup.userId,
        venueId: 'platform',
        amount: amountPaise / 100,
        expectedAmountPaise: expected,
        currency: currency || 'INR',
        paymentMethod: 'Razorpay',
        paymentGateway: 'Razorpay',
        transactionId: paymentId,
        razorpayOrderId,
        status: 'Completed',
        rawEvent: event,
        paymentDate: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, {merge: true});
    });
  }

  async function resolveWebhookSource(notes, paymentId, razorpayOrderId) {
    for (const [sourceType, config] of Object.entries(SOURCE_CONFIG)) {
      const sourceId = cleanString(notes[config.idNote]);
      if (sourceId) return {sourceType, sourceId};
    }
    const notedType = cleanString(notes.sourceType);
    const notedId = cleanString(notes.sourceId);
    if (SOURCE_CONFIG[notedType] && notedId) return {sourceType: notedType, sourceId: notedId};
    if (paymentId) {
      const paymentSnapshot = await db.collection('payments').doc(paymentId).get();
      if (paymentSnapshot.exists) {
        const payment = paymentSnapshot.data();
        if (SOURCE_CONFIG[payment.sourceType] && cleanString(payment.sourceId)) {
          return {sourceType: payment.sourceType, sourceId: payment.sourceId};
        }
      }
    }
    if (razorpayOrderId) {
      for (const [sourceType, config] of Object.entries(SOURCE_CONFIG)) {
        const snapshot = await db.collection(config.collection)
          .where('razorpayOrderId', '==', razorpayOrderId).limit(1).get();
        if (!snapshot.empty) return {sourceType, sourceId: snapshot.docs[0].id};
      }
    }
    return {sourceType: null, sourceId: null};
  }

  const razorpayWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET ||
      (functions.config().razorpay && functions.config().razorpay.webhook_secret);
    if (!secret) {
      res.status(503).json({error: 'Webhook secret not configured'});
      return;
    }
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    if (!paymentSignatureIsValid(rawBody, req.get('x-razorpay-signature') || '', secret)) {
      res.status(400).json({error: 'Invalid signature'});
      return;
    }
    const payload = req.body || {};
    const event = cleanString(payload.event);
    const razorpayPayload = payload.payload || {};
    const payment = razorpayPayload.payment?.entity || null;
    const order = razorpayPayload.order?.entity || null;
    const refund = razorpayPayload.refund?.entity || null;
    const entity = payment || order || refund || {};
    const notes = {...(order?.notes || {}), ...(payment?.notes || {}), ...(refund?.notes || {})};
    const paymentId = cleanString(payment?.id) || cleanString(refund?.payment_id);
    const razorpayOrderId = cleanString(payment?.order_id) || cleanString(order?.id);
    const amountPaise = Number(payment?.amount || order?.amount_paid || entity.amount || 0);
    try {
      const {sourceType, sourceId} = await resolveWebhookSource(notes, paymentId, razorpayOrderId);
      if (['payment.captured', 'order.paid'].includes(event)) {
        if (!sourceType || !sourceId || !paymentId || !razorpayOrderId ||
            !Number.isInteger(amountPaise) || amountPaise <= 0) {
          throw httpError('Captured payment metadata is incomplete', 409);
        }
        if (sourceType === 'Wallet') {
          await fulfillWalletTopup({
            sourceId, paymentId, razorpayOrderId, amountPaise,
            currency: entity.currency, event,
          });
        } else {
          await fulfillCapturedPayment({
            sourceType, sourceId, paymentId, razorpayOrderId, amountPaise,
            currency: entity.currency, event,
          });
        }
      } else if (event === 'payment.failed' && sourceType && sourceId) {
        const config = SOURCE_CONFIG[sourceType];
        const sourceRef = db.collection(config.collection).doc(sourceId);
        await db.runTransaction(async (transaction) => {
          const current = await transaction.get(sourceRef);
          if (!current.exists || current.data().paymentStatus === 'Paid') return;
          const update = {
            paymentStatus: 'Failed',
            paymentFailedAt: now(),
            updatedAt: now(),
            status: sourceType === 'Wallet' ? 'Failed' : 'Cancelled',
          };
          transaction.set(sourceRef, update, {merge: true});
          if (sourceType === 'Booking' && cleanString(current.data().slotLockId)) {
            transaction.delete(
              db.collection('booking_slot_locks').doc(current.data().slotLockId),
            );
          }
        });
      } else if (['refund.created', 'refund.processed'].includes(event) &&
          sourceType && sourceId) {
        const paymentRef = db.collection('payments')
          .doc(paymentId || `refund_${safeDocumentId(refund.id, 'refund id')}`);
        const refundedPaise = Number(refund?.amount || payment?.amount_refunded || 0);
        const refundId = safeDocumentId(refund?.id, 'refund id');
        const refundRef = db.collection('refunds').doc(refundId);
        await db.runTransaction(async (transaction) => {
          const [paymentSnapshot, refundSnapshot] = await Promise.all([
            transaction.get(paymentRef),
            transaction.get(refundRef),
          ]);
          const original = paymentSnapshot.data() || {};
          const originalPaise = Math.round(Number(original.amount || 0) * 100);
          const previousRefundedPaise = Math.round(
            Number(original.amountRefunded || 0) * 100,
          );
          const totalRefundedPaise = refundSnapshot.data()?.webhookProcessedAt ?
            previousRefundedPaise :
            Math.min(originalPaise, previousRefundedPaise + refundedPaise);
          const status = originalPaise > totalRefundedPaise ?
            'Partially Refunded' : 'Refunded';
          transaction.set(paymentRef, {
            status,
            amountRefunded: totalRefundedPaise / 100,
            refundId,
            updatedAt: now(),
          }, {merge: true});
          transaction.set(refundRef, {
            razorpayRefundId: refundId,
            razorpayPaymentId: paymentId,
            paymentId: paymentRef.id,
            sourceType,
            sourceId,
            amount: refundedPaise / 100,
            amountPaise: refundedPaise,
            status: refund?.status || 'Processed',
            webhookProcessedAt: now(),
            updatedAt: now(),
          }, {merge: true});
          transaction.set(db.collection(SOURCE_CONFIG[sourceType].collection).doc(sourceId), {
            paymentStatus: status,
            ...(sourceType === 'Order' && status === 'Refunded' ? {status: 'Refunded'} : {}),
            refundedAt: now(),
            updatedAt: now(),
          }, {merge: true});
        });
      }
      res.json({received: true});
    } catch (error) {
      console.error('razorpayWebhook authoritative handler failed:', error);
      res.status(error.status || 500).json({error: error.message || 'Webhook handler failed'});
    }
  });

  const spendWallet = functions.https.onRequest(async (req, res) => {
    const auth = await requireAuthenticatedPost(req, res);
    if (!auth) return;
    try {
      const sourceType = cleanString(req.body?.sourceType);
      const sourceId = safeDocumentId(req.body?.sourceId, 'sourceId');
      if (!['Booking', 'Membership', 'Order'].includes(sourceType)) {
        throw httpError('sourceType must be Booking, Membership, or Order');
      }
      const source = await {
        Booking: authoritativeBooking,
        Membership: authoritativeMembership,
        Order: authoritativeOrder,
      }[sourceType](sourceId, auth.uid);
      const walletPaymentId = `wallet_${sourceType}_${sourceId}`;
      const sourceRef = source.ref;
      const walletPaymentRef = db.collection('payments').doc(walletPaymentId);
      const settingsSnapshot = await db.collection('appSettings').doc('platform').get();
      const settlementSettings = settingsSnapshot.data() || {};
      await db.runTransaction(async (transaction) => {
        const [userSnapshot, sourceSnapshot, paymentSnapshot] = await Promise.all([
          transaction.get(db.collection('users').doc(auth.uid)),
          transaction.get(sourceRef),
          transaction.get(walletPaymentRef),
        ]);
        if (!userSnapshot.exists || !sourceSnapshot.exists) throw httpError('Wallet source not found', 404);
        const freshSource = sourceSnapshot.data();
        if (paymentSnapshot.exists && paymentSnapshot.data().status === 'Completed') return;
        if (freshSource.paymentStatus === 'Paid') {
          throw httpError('Source has already been paid by another method', 409);
        }
        const balancePaise = Number.isInteger(userSnapshot.data().walletBalancePaise) ?
          userSnapshot.data().walletBalancePaise :
          Math.round(Number(userSnapshot.data().walletBalance || 0) * 100);
        if (balancePaise < source.expectedAmountPaise) throw httpError('Insufficient wallet balance', 409);
        const timestamp = now();
        const balanceAfterPaise = balancePaise - source.expectedAmountPaise;
        const sourceUpdate = {
          paymentStatus: 'Paid',
          paymentMethod: 'Wallet',
          paymentTransactionId: walletPaymentId,
          expectedAmountPaise: source.expectedAmountPaise,
          webhookVerifiedAt: timestamp,
          updatedAt: timestamp,
          status: sourceType === 'Membership' ? 'Active' :
            (sourceType === 'Order' ? 'Processing' : 'Confirmed'),
        };
        if (sourceType === 'Order' && !freshSource.inventoryDeductedAt) {
          const refs = source.items.map((item) => db.collection('products').doc(item.productId));
          const products = await Promise.all(refs.map((ref) => transaction.get(ref)));
          products.forEach((productSnapshot, index) => {
            const product = productSnapshot.data();
            const quantity = source.items[index].quantity;
            if (!productSnapshot.exists || Number(product.stock) < quantity) {
              throw httpError('Insufficient marketplace inventory', 409);
            }
            const stock = Number(product.stock) - quantity;
            transaction.update(productSnapshot.ref, {
              stock,
              status: productStatus(stock, product.minStock),
              salesCount: admin.firestore.FieldValue.increment(quantity),
              revenue: admin.firestore.FieldValue.increment(source.items[index].price * quantity),
              updatedAt: timestamp,
            });
          });
          sourceUpdate.inventoryDeductedAt = timestamp;
          sourceUpdate.inventoryPaymentId = walletPaymentId;
        }
        transaction.set(userSnapshot.ref, {
          walletBalance: balanceAfterPaise / 100,
          walletBalancePaise: balanceAfterPaise,
          updatedAt: timestamp,
        }, {merge: true});
        transaction.set(sourceRef, sourceUpdate, {merge: true});
        transaction.set(db.collection('walletTransactions').doc(walletPaymentId), {
          userId: auth.uid,
          type: 'Debit',
          sourceType,
          sourceId,
          amount: source.expectedAmountPaise / 100,
          amountPaise: source.expectedAmountPaise,
          balanceAfter: balanceAfterPaise / 100,
          balanceAfterPaise,
          description: `${sourceType} payment`,
          status: 'Completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        }, {merge: true});
        transaction.set(walletPaymentRef, {
          type: 'Online',
          direction: source.venueId === 'platform' ? 'UserToPlatform' : 'UserToVenue',
          sourceType,
          sourceId,
          userId: auth.uid,
          venueId: source.venueId,
          amount: source.expectedAmountPaise / 100,
          expectedAmountPaise: source.expectedAmountPaise,
          paymentMethod: 'Wallet',
          transactionId: walletPaymentId,
          status: 'Completed',
          paymentDate: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        }, {merge: true});
        settlementWrites(
          transaction,
          sourceType,
          sourceId,
          freshSource,
          source.expectedAmountPaise,
          timestamp,
          settlementSettings,
        );
      });
      res.json({success: true, paymentId: walletPaymentId});
    } catch (error) {
      console.error('spendWallet failed:', error);
      res.status(error.status || 500).json({error: error.message || 'Wallet payment failed'});
    }
  });

  const adjustWallet = functions.https.onRequest(async (req, res) => {
    const auth = await requireAdminPost(req, res, true);
    if (!auth) return;
    try {
      const userId = safeDocumentId(req.body?.userId, 'userId');
      const amountPaise = Number(req.body?.amountPaise);
      const reason = cleanString(req.body?.reason);
      const idempotencyKey = safeDocumentId(req.body?.idempotencyKey, 'idempotencyKey');
      if (!Number.isInteger(amountPaise) || amountPaise === 0 ||
          Math.abs(amountPaise) > 10000000) {
        throw httpError('amountPaise must be a non-zero integer up to ₹100,000');
      }
      if (!reason || reason.length < 3 || reason.length > 300) {
        throw httpError('A reason between 3 and 300 characters is required');
      }
      const transactionRef = db.collection('walletTransactions')
        .doc(`adjustment_${idempotencyKey}`);
      await db.runTransaction(async (transaction) => {
        const [existing, userSnapshot] = await Promise.all([
          transaction.get(transactionRef),
          transaction.get(db.collection('users').doc(userId)),
        ]);
        if (existing.exists) {
          if (existing.data().userId !== userId || existing.data().amountPaise !== amountPaise) {
            throw httpError('Idempotency key was already used for another adjustment', 409);
          }
          return;
        }
        if (!userSnapshot.exists) throw httpError('User not found', 404);
        const balancePaise = Number.isInteger(userSnapshot.data().walletBalancePaise) ?
          userSnapshot.data().walletBalancePaise :
          Math.round(Number(userSnapshot.data().walletBalance || 0) * 100);
        const balanceAfterPaise = balancePaise + amountPaise;
        if (balanceAfterPaise < 0) throw httpError('Adjustment would overdraw the wallet', 409);
        const timestamp = now();
        transaction.set(userSnapshot.ref, {
          walletBalance: balanceAfterPaise / 100,
          walletBalancePaise: balanceAfterPaise,
          updatedAt: timestamp,
        }, {merge: true});
        transaction.create(transactionRef, {
          userId,
          type: amountPaise > 0 ? 'Credit' : 'Debit',
          kind: 'AdminAdjustment',
          amount: Math.abs(amountPaise) / 100,
          amountPaise,
          balanceAfter: balanceAfterPaise / 100,
          balanceAfterPaise,
          description: reason,
          adjustedBy: auth.uid,
          status: 'Completed',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
      res.json({success: true, transactionId: transactionRef.id});
    } catch (error) {
      console.error('adjustWallet failed:', error);
      res.status(error.status || 500).json({error: error.message || 'Wallet adjustment failed'});
    }
  });

  const createRazorpayRefund = functions.https.onRequest(async (req, res) => {
    const auth = await requireAdminPost(req, res);
    if (!auth) return;
    try {
      const paymentId = safeDocumentId(req.body?.paymentId, 'paymentId');
      const amountPaise = Number(req.body?.amountPaise);
      const reason = cleanString(req.body?.reason);
      const paymentSnapshot = await db.collection('payments').doc(paymentId).get();
      if (!paymentSnapshot.exists) throw httpError('Payment not found', 404);
      const payment = paymentSnapshot.data();
      if (payment.status !== 'Completed' || payment.paymentGateway !== 'Razorpay' ||
          !cleanString(payment.transactionId)) {
        throw httpError('Only completed Razorpay payments can be refunded', 409);
      }
      if (!auth.isSuperAdmin &&
          !(auth.userData.managedVenues || []).includes(payment.venueId)) {
        throw httpError('Payment is outside your managed venues', 403);
      }
      const paidPaise = Math.round(Number(payment.amount || 0) * 100);
      const alreadyRefundedPaise = Math.round(Number(payment.amountRefunded || 0) * 100);
      const refundPaise = amountPaise == null ? paidPaise - alreadyRefundedPaise : amountPaise;
      if (!Number.isInteger(refundPaise) || refundPaise <= 0 ||
          refundPaise > paidPaise - alreadyRefundedPaise) {
        throw httpError('Refund amount exceeds the refundable balance');
      }
      if (!reason || reason.length < 3 || reason.length > 300) {
        throw httpError('A refund reason between 3 and 300 characters is required');
      }
      const {keyId, keySecret} = getRazorpayCredentials();
      if (!keyId || !keySecret) throw httpError('Razorpay is not configured', 503);
      const response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.transactionId)}/refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: refundPaise,
            notes: {
              sourceType: payment.sourceType,
              sourceId: payment.sourceId,
              reason,
              requestedBy: auth.uid,
            },
          }),
        },
      );
      const refund = await response.json().catch(() => ({}));
      if (!response.ok || !refund.id) {
        throw httpError(refund.error?.description || 'Razorpay refund request failed', 502);
      }
      await db.collection('refunds').doc(refund.id).set({
        razorpayRefundId: refund.id,
        razorpayPaymentId: payment.transactionId,
        paymentId,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        userId: payment.userId || null,
        venueId: payment.venueId,
        amount: refundPaise / 100,
        amountPaise: refundPaise,
        reason,
        status: refund.status || 'Pending',
        requestedBy: auth.uid,
        createdAt: now(),
        updatedAt: now(),
      });
      res.status(201).json({refundId: refund.id, status: refund.status, amountPaise: refundPaise});
    } catch (error) {
      console.error('createRazorpayRefund failed:', error);
      res.status(error.status || 500).json({error: error.message || 'Refund failed'});
    }
  });

  async function castVote(uid, data) {
    const pollId = safeDocumentId(data?.pollId, 'pollId');
    const optionId = cleanString(data?.optionId);
    if (!optionId || optionId.length > 150) throw httpError('optionId is invalid');
    return db.runTransaction(async (transaction) => {
      const pollRef = db.collection('polls').doc(pollId);
      const voteRef = pollRef.collection('votes').doc(uid);
      const [pollSnapshot, voteSnapshot] = await Promise.all([
        transaction.get(pollRef),
        transaction.get(voteRef),
      ]);
      if (!pollSnapshot.exists) throw httpError('Poll not found', 404);
      if (voteSnapshot.exists) throw httpError('User has already voted', 409);
      const poll = pollSnapshot.data();
      if (poll.status !== 'Active' || (asDate(poll.endDate) && asDate(poll.endDate) < new Date())) {
        throw httpError('Poll is not active', 409);
      }
      const options = Array.isArray(poll.options) ? poll.options.map((option) => ({...option})) : [];
      const option = options.find((entry) => String(entry.id) === optionId);
      if (!option) throw httpError('Poll option not found', 404);
      option.votes = Number(option.votes || 0) + 1;
      const timestamp = now();
      transaction.create(voteRef, {userId: uid, optionId, createdAt: timestamp});
      transaction.update(pollRef, {
        options,
        totalVotes: Number(poll.totalVotes || 0) + 1,
        votedUserIds: admin.firestore.FieldValue.arrayUnion(uid),
        updatedAt: timestamp,
      });
      return {pollId, optionId, totalVotes: Number(poll.totalVotes || 0) + 1};
    });
  }

  const votePoll = functions.https.onRequest(async (req, res) => {
    const auth = await requireAuthenticatedPost(req, res);
    if (!auth) return;
    try {
      res.json(await castVote(auth.uid, req.body));
    } catch (error) {
      res.status(error.status || 500).json({error: error.message || 'Vote failed'});
    }
  });

  const votePollCallable = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    try {
      return await castVote(request.auth.uid, request.data);
    } catch (error) {
      const code = error.status === 404 ? 'not-found' :
        error.status === 409 ? 'already-exists' : 'invalid-argument';
      throw new HttpsError(code, error.message);
    }
  });

  const cleanupStalePendingBookings = onSchedule(
    {schedule: 'every 15 minutes', timeZone: 'Asia/Kolkata'},
    async () => {
      const settingsSnapshot = await db.collection('appSettings').doc('platform').get();
      const checkoutTtlMinutes = normalizedCheckoutTtlMinutes(
        settingsSnapshot.data()?.checkoutTtlMinutes,
      );
      const cutoff = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - checkoutTtlMinutes * 60 * 1000),
      );
      const snapshot = await db.collection('bookings')
        .where('status', '==', 'Pending')
        .where('createdAt', '<=', cutoff)
        .limit(400)
        .get();
      for (const document of snapshot.docs) {
        await db.runTransaction(async (transaction) => {
          const current = await transaction.get(document.ref);
          if (!current.exists) return;
          const booking = current.data();
          if (booking.status !== 'Pending' || booking.paymentStatus === 'Paid') return;
          transaction.update(document.ref, {
            status: 'Cancelled',
            paymentStatus: booking.paymentStatus === 'Pending' ? 'Failed' : booking.paymentStatus,
            cancellationReason: 'Payment window expired',
            stalePaymentCancelledAt: now(),
            updatedAt: now(),
          });
          if (cleanString(booking.slotLockId)) {
            transaction.delete(db.collection('booking_slot_locks').doc(booking.slotLockId));
          }
          transaction.delete(db.collection('courtAvailability').doc(document.id));
        });
      }
      console.log(`Processed ${snapshot.size} stale pending booking candidates`);
    },
  );

  const banUser = functions.https.onRequest(async (req, res) => {
    const auth = await requireAdminPost(req, res, true);
    if (!auth) return;
    try {
      const userId = safeDocumentId(req.body?.userId, 'userId');
      const reason = cleanString(req.body?.reason);
      if (userId === auth.uid) throw httpError('You cannot ban your own account', 409);
      if (!reason || reason.length < 3 || reason.length > 300) {
        throw httpError('A ban reason between 3 and 300 characters is required');
      }
      const target = await admin.auth().getUser(userId);
      if (target.customClaims?.super_admin === true) {
        throw httpError('Remove super-admin privileges before banning this user', 409);
      }
      await admin.auth().updateUser(userId, {disabled: true});
      await admin.auth().revokeRefreshTokens(userId);
      const tokenSnapshot = await db.collection('fcmTokens').where('userId', '==', userId).get();
      const batch = db.batch();
      batch.set(db.collection('users').doc(userId), {
        status: 'Banned',
        isActive: false,
        bannedBy: auth.uid,
        banReason: reason,
        bannedAt: now(),
        updatedAt: now(),
      }, {merge: true});
      tokenSnapshot.docs.forEach((document) => batch.set(document.ref, {
        isActive: false,
        deactivatedReason: 'user_banned',
        invalidatedAt: now(),
      }, {merge: true}));
      await batch.commit();
      res.json({success: true, userId});
    } catch (error) {
      console.error('banUser failed:', error);
      const status = error.code === 'auth/user-not-found' ? 404 : error.status || 500;
      res.status(status).json({error: error.message || 'Could not ban user'});
    }
  });

  const sendWhatsAppMessage = functions.https.onRequest(async (req, res) => {
    const auth = await requireAdminPost(req, res);
    if (!auth) return;
    try {
      const endpoint = cleanString(process.env.WHATSAPP_API_URL);
      const token = cleanString(process.env.WHATSAPP_API_TOKEN);
      if (!endpoint || !token || !endpoint.startsWith('https://')) {
        throw httpError('WhatsApp provider is not safely configured', 503);
      }
      const phone = cleanString(req.body?.phone);
      const message = cleanString(req.body?.message);
      if (!phone || !/^\+?[1-9]\d{7,14}$/.test(phone) ||
          !message || message.length > 1000) {
        throw httpError('A valid E.164 phone and message up to 1000 characters are required');
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({to: phone, type: 'text', text: {body: message}}),
      });
      if (!response.ok) throw httpError('WhatsApp provider rejected the request', 502);
      await db.collection('whatsappMessages').add({
        phone,
        message,
        sentBy: auth.uid,
        status: 'Sent',
        createdAt: now(),
      });
      res.json({success: true});
    } catch (error) {
      res.status(error.status || 500).json({error: error.message || 'WhatsApp send failed'});
    }
  });

  const integrationHealth = functions.https.onRequest(async (req, res) => {
    const auth = await requireAdminPost(req, res, true);
    if (!auth) return;
    const integration = cleanString(req.body?.integration);
    const checkedAt = new Date().toISOString();
    try {
      if (integration === 'razorpay') {
        const {keyId, keySecret} = getRazorpayCredentials();
        if (!keyId || !keySecret) {
          res.json({
            integration,
            configured: false,
            enabled: false,
            healthy: false,
            status: 'Setup Required',
            checkedAt,
            message: 'Razorpay server credentials are not configured.',
          });
          return;
        }
        const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          },
        });
        res.json({
          integration,
          configured: true,
          enabled: true,
          healthy: response.ok,
          status: response.ok ? 'Connected' : 'Unhealthy',
          checkedAt,
          message: response.ok ?
            'Razorpay credentials were verified with the provider.' :
            'Razorpay rejected the configured credentials.',
        });
        return;
      }
      if (integration === 'whatsapp') {
        const configured = Boolean(
          cleanString(process.env.WHATSAPP_API_URL) &&
          cleanString(process.env.WHATSAPP_API_TOKEN),
        );
        res.json({
          integration,
          configured,
          enabled: configured,
          healthy: configured,
          status: configured ? 'Connected' : 'Setup Required',
          checkedAt,
          message: configured ?
            'WhatsApp server credentials are configured. Send a test message to verify delivery.' :
            'WhatsApp server credentials are not configured.',
        });
        return;
      }
      throw httpError('integration must be razorpay or whatsapp');
    } catch (error) {
      res.status(error.status || 500).json({
        integration: integration || 'unknown',
        configured: false,
        enabled: false,
        healthy: false,
        status: 'Unhealthy',
        checkedAt,
        message: error.message || 'Integration health check failed',
      });
    }
  });

  const generateTournamentBracket = functions.https.onRequest(async (req, res) => {
    const auth = await requireAdminPost(req, res);
    if (!auth) return;
    try {
      const tournamentId = safeDocumentId(req.body?.tournamentId, 'tournamentId');
      const requestedTeamIds = Array.isArray(req.body?.teamIds) ?
        [...new Set(req.body.teamIds.map((id) => safeDocumentId(id, 'teamId')))] : [];
      const format = cleanString(req.body?.format) || 'Single Elimination';
      if (format !== 'Single Elimination') {
        throw httpError('Only Single Elimination bracket generation is currently supported');
      }
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentSnapshot = await tournamentRef.get();
      if (!tournamentSnapshot.exists) throw httpError('Tournament not found', 404);
      const tournament = tournamentSnapshot.data();
      if (!auth.isSuperAdmin &&
          !(auth.userData.managedVenues || []).includes(tournament.venueId)) {
        throw httpError('Tournament is outside your managed venues', 403);
      }
      if (Array.isArray(tournament.matches) && tournament.matches.length > 0) {
        throw httpError('A bracket already exists. Remove existing matches before regenerating.', 409);
      }
      const eligibleTeams = (Array.isArray(tournament.teams) ? tournament.teams : [])
        .filter((team) => ['Approved', 'Paid'].includes(team.status))
        .filter((team) => requestedTeamIds.length === 0 || requestedTeamIds.includes(team.id))
        .map((team) => ({
          id: safeDocumentId(team.id, 'teamId'),
          name: cleanString(team.name) || 'Team',
        }));
      if (requestedTeamIds.length > 0 &&
          eligibleTeams.length !== requestedTeamIds.length) {
        throw httpError('One or more selected teams are not eligible for this bracket', 409);
      }
      const matches = buildSingleEliminationBracket(tournamentId, eligibleTeams);
      await tournamentRef.update({
        bracketType: format,
        matches,
        bracketGeneratedAt: now(),
        bracketGeneratedBy: auth.uid,
        updatedAt: now(),
      });
      res.status(201).json({tournamentId, matches});
    } catch (error) {
      console.error('generateTournamentBracket failed:', error);
      res.status(error.status || 500).json({
        error: error.message || 'Could not generate tournament bracket',
      });
    }
  });

  return {
    createBookingPaymentOrder,
    createMembershipPaymentOrder,
    createMarketplacePaymentOrder,
    razorpayWebhook,
    spendWallet,
    adjustWallet,
    createRazorpayRefund,
    votePoll,
    votePollCallable,
    cleanupStalePendingBookings,
    banUser,
    sendWhatsAppMessage,
    integrationHealth,
    generateTournamentBracket,
    // Deliberately non-deployed test surface: exposes the same closures used by
    // the handlers so unit tests can exercise transactions without credentials.
    _test: {
      authoritativeBooking,
      authoritativeMembership,
      authoritativeOrder,
      fulfillCapturedPayment,
      fulfillWalletTopup,
      settlementWrites,
      castVote,
    },
  };
};

module.exports._test = {
  toPaise,
  normalizeVenueId,
  paymentSignatureIsValid,
  productStatus,
  membershipEndDate,
  normalizedCheckoutTtlMinutes,
  buildSingleEliminationBracket,
};
