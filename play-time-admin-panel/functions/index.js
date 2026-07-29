/**
 * Cloud Functions for Firebase
 * FCM Push Notification Service + Razorpay webhooks
 *
 * Security:
 * - All outbound notification endpoints (sendNotification*) require a Firebase ID
 *   token in `Authorization: Bearer <idToken>` and the caller must have role
 *   `super_admin` or `venue_manager` in the `users` collection.
 * - Razorpay webhook verifies an HMAC signature using the configured secret.
 */

const functions = require('firebase-functions');
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require('firebase-functions/v2/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Built-in admin UI origins (custom hosting). Env ALLOWED_ORIGINS can add more. */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://playtime.jodtech.in',
  'https://jodtech.playtime.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** Allow-list of origins for admin-panel requests (env ALLOWED_ORIGINS = comma list). */
function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  const fromEnv = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
}

/** Set CORS headers. Echoes the request Origin when it is in the allow-list. */
function applyCors(req, res) {
  const allowed = getAllowedOrigins();
  const origin = req.get('origin') || '';
  if (allowed.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Non-browser clients (no Origin header)
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * Verify Firebase ID token in the `Authorization: Bearer <token>` header and
 * check the caller has an admin role. Returns decoded token + user doc, or
 * sends an HTTP error and returns null.
 */
async function requireAdmin(req, res) {
  const authHeader = req.get('authorization') || req.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({error: 'Missing or invalid Authorization header'});
    return null;
  }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (err) {
    console.warn('verifyIdToken failed:', err.message);
    res.status(401).json({error: 'Invalid ID token'});
    return null;
  }
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(decoded.uid)
    .get();
  if (!userDoc.exists) {
    res.status(403).json({error: 'User record not found'});
    return null;
  }
  const role = userDoc.data().role;
  // System admin roles are always allowed. Custom roles are allowed when a
  // matching roles/{roleId} document exists (they are venue-scoped admins).
  let isAdminRole = role === 'super_admin' || role === 'venue_manager';
  if (!isAdminRole && role && role !== 'player') {
    const roleDoc = await admin.firestore().collection('roles').doc(role).get();
    isAdminRole = roleDoc.exists;
  }
  if (!isAdminRole) {
    res.status(403).json({error: 'Insufficient privileges'});
    return null;
  }
  return {
    uid: decoded.uid,
    role,
    isSuperAdmin: role === 'super_admin',
    userData: userDoc.data(),
  };
}

/** Verify a Firebase ID token without requiring an admin role. */
async function requireAuthenticated(req, res) {
  const authHeader = req.get('authorization') || req.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({error: 'Missing or invalid Authorization header'});
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return {uid: decoded.uid, token: decoded};
  } catch (err) {
    console.warn('verifyIdToken failed:', err.message);
    res.status(401).json({error: 'Invalid ID token'});
    return null;
  }
}

/** Apply the common CORS/method/auth checks for an authenticated POST. */
async function requireAuthenticatedPost(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return null;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return null;
  }
  return requireAuthenticated(req, res);
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const result = value instanceof Date ? value : new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Secure player mutations
// ---------------------------------------------------------------------------

/**
 * Join or leave a squad without allowing clients to rewrite its member list.
 * POST body: {teamId, action: "join"|"leave"}
 */
exports.updateTeamMembership = functions.https.onRequest(async (req, res) => {
  const auth = await requireAuthenticatedPost(req, res);
  if (!auth) return;

  const teamId = cleanString(req.body && req.body.teamId);
  const action = cleanString(req.body && req.body.action);
  if (!teamId || !['join', 'leave'].includes(action)) {
    res.status(400).json({error: 'teamId and a valid action are required'});
    return;
  }

  const teamRef = admin.firestore().collection('teams').doc(teamId);
  try {
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(teamRef);
      if (!snapshot.exists) throw new Error('TEAM_NOT_FOUND');

      const data = snapshot.data() || {};
      const members = Array.isArray(data.members) ? data.members : [];
      const memberId = (member) => typeof member === 'string' ?
        member :
        cleanString(member && (member.id || member.userId));
      const alreadyMember = members.some((member) => memberId(member) === auth.uid);

      if (action === 'join') {
        if (alreadyMember) return {joined: true, alreadyMember: true};
        if (members.length >= 15) throw new Error('TEAM_FULL');
        transaction.update(teamRef, {
          members: [...members, auth.uid],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {joined: true, alreadyMember: false};
      }

      if (data.createdBy === auth.uid) throw new Error('OWNER_CANNOT_LEAVE');
      if (!alreadyMember) return {joined: false, alreadyMember: false};
      transaction.update(teamRef, {
        members: members.filter((member) => memberId(member) !== auth.uid),
        [`memberRoles.${auth.uid}`]: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {joined: false, alreadyMember: true};
    });
    res.json(result);
  } catch (error) {
    const status = error.message === 'TEAM_NOT_FOUND' ? 404 :
      error.message === 'TEAM_FULL' || error.message === 'OWNER_CANNOT_LEAVE' ? 409 : 500;
    const message = {
      TEAM_NOT_FOUND: 'Squad not found.',
      TEAM_FULL: 'This squad is already full.',
      OWNER_CANNOT_LEAVE: 'The squad owner cannot leave their own squad.',
    }[error.message] || 'Could not update squad membership.';
    console.error('updateTeamMembership failed:', error);
    res.status(status).json({error: message});
  }
});

/**
 * Join or leave a quick match without allowing clients to rewrite playerIds.
 * POST body: {matchId, action: "join"|"leave"}
 */
exports.updateQuickMatchParticipation = functions.https.onRequest(async (req, res) => {
  const auth = await requireAuthenticatedPost(req, res);
  if (!auth) return;

  const matchId = cleanString(req.body && req.body.matchId);
  const action = req.body && req.body.action;
  if (!matchId || !['join', 'leave'].includes(action)) {
    res.status(400).json({error: 'Required: matchId and action (join or leave)'});
    return;
  }

  try {
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const ref = admin.firestore().collection('quickMatches').doc(matchId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error('Quick match not found'), {status: 404});

      const match = snapshot.data();
      const playerIds = Array.isArray(match.playerIds) ? [...new Set(match.playerIds)] : [];
      const alreadyJoined = playerIds.includes(auth.uid);
      const maxPlayers = Number(match.maxPlayers);

      if (action === 'join') {
        if (!['Open', 'Full'].includes(match.status)) {
          throw Object.assign(new Error('Quick match is not open'), {status: 409});
        }
        if (alreadyJoined) return {joined: true, currentPlayers: playerIds.length, unchanged: true};
        if (!Number.isFinite(maxPlayers) || maxPlayers <= 0 || playerIds.length >= maxPlayers) {
          throw Object.assign(new Error('Quick match is full'), {status: 409});
        }
        playerIds.push(auth.uid);
      } else {
        if (!alreadyJoined) return {joined: false, currentPlayers: playerIds.length, unchanged: true};
        playerIds.splice(playerIds.indexOf(auth.uid), 1);
      }

      const currentPlayers = playerIds.length;
      const status = currentPlayers >= maxPlayers ? 'Full' : 'Open';
      transaction.update(ref, {
        playerIds,
        currentPlayers,
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {joined: action === 'join', currentPlayers, status};
    });
    res.json({matchId, ...result});
  } catch (error) {
    console.error('updateQuickMatchParticipation error:', error);
    res.status(error.status || 500).json({error: error.message || 'Participation update failed'});
  }
});

/**
 * Cast one immutable vote per authenticated user.
 * POST body: {pollId, optionId}
 */
exports.voteInPoll = functions.https.onRequest(async (req, res) => {
  const auth = await requireAuthenticatedPost(req, res);
  if (!auth) return;

  const pollId = cleanString(req.body && req.body.pollId);
  const optionId = cleanString(req.body && req.body.optionId);
  if (!pollId || !optionId) {
    res.status(400).json({error: 'Required: pollId and optionId'});
    return;
  }

  try {
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const ref = admin.firestore().collection('polls').doc(pollId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error('Poll not found'), {status: 404});

      const poll = snapshot.data();
      if (poll.status !== 'Active') throw Object.assign(new Error('Poll is not active'), {status: 409});
      const deadline = asDate(poll.endDate);
      if (deadline && deadline.getTime() < Date.now()) {
        throw Object.assign(new Error('Poll has ended'), {status: 409});
      }

      const votedUserIds = Array.isArray(poll.votedUserIds) ? poll.votedUserIds : [];
      if (votedUserIds.includes(auth.uid)) {
        throw Object.assign(new Error('User has already voted'), {status: 409});
      }
      const options = Array.isArray(poll.options) ? poll.options.map((option) => ({...option})) : [];
      const option = options.find((candidate) => String(candidate.id) === optionId);
      if (!option) throw Object.assign(new Error('Poll option not found'), {status: 404});

      option.votes = Number(option.votes || 0) + 1;
      const totalVotes = Number(poll.totalVotes || 0) + 1;
      transaction.update(ref, {
        options,
        totalVotes,
        votedUserIds: [...votedUserIds, auth.uid],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {optionId, totalVotes};
    });
    res.json({pollId, ...result});
  } catch (error) {
    console.error('voteInPoll error:', error);
    res.status(error.status || 500).json({error: error.message || 'Vote failed'});
  }
});

/**
 * Register the caller as a tournament player, enforcing deadline, capacity,
 * and one registration per UID.
 * POST body: {tournamentId, teamId?, displayName?, phone?}
 */
exports.registerTournamentPlayer = functions.https.onRequest(async (req, res) => {
  const auth = await requireAuthenticatedPost(req, res);
  if (!auth) return;

  const tournamentId = cleanString(req.body && req.body.tournamentId);
  const teamId = cleanString(req.body && req.body.teamId);
  if (!tournamentId) {
    res.status(400).json({error: 'Required: tournamentId'});
    return;
  }

  try {
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const tournamentRef = admin.firestore().collection('tournaments').doc(tournamentId);
      const registrationId = teamId ? `team_${teamId}` : auth.uid;
      const registrationRef = tournamentRef.collection('registrations').doc(registrationId);
      const teamRef = teamId ? admin.firestore().collection('teams').doc(teamId) : null;
      const [tournamentSnapshot, registrationSnapshot, teamSnapshot] = await Promise.all([
        transaction.get(tournamentRef),
        transaction.get(registrationRef),
        teamRef ? transaction.get(teamRef) : Promise.resolve(null),
      ]);
      if (!tournamentSnapshot.exists) {
        throw Object.assign(new Error('Tournament not found'), {status: 404});
      }
      if (registrationSnapshot.exists) {
        throw Object.assign(
          new Error(teamId ? 'This team is already registered' : 'User is already registered'),
          {status: 409},
        );
      }
      if (teamId) {
        if (!teamSnapshot || !teamSnapshot.exists) {
          throw Object.assign(new Error('Team not found'), {status: 404});
        }
        const team = teamSnapshot.data();
        const members = Array.isArray(team.members) ? team.members : [];
        if (team.createdBy !== auth.uid && team.captainId !== auth.uid && !members.includes(auth.uid)) {
          throw Object.assign(new Error('You are not authorized to register this team'), {status: 403});
        }
      }

      const tournament = tournamentSnapshot.data();
      if (tournament.status !== 'Open') {
        throw Object.assign(new Error('Tournament registration is not open'), {status: 409});
      }
      const starts = asDate(tournament.registrationStartDate);
      const deadline = asDate(tournament.registrationEndDate);
      const now = Date.now();
      if (starts && starts.getTime() > now) {
        throw Object.assign(new Error('Tournament registration has not started'), {status: 409});
      }
      if (deadline && deadline.getTime() < now) {
        throw Object.assign(new Error('Tournament registration deadline has passed'), {status: 409});
      }

      const registrationCount = Number(tournament.registrationCount || 0);
      const capacity = Number(tournament.maxPlayers || tournament.maxTeams);
      if (Number.isFinite(capacity) && capacity > 0 && registrationCount >= capacity) {
        throw Object.assign(new Error('Tournament is full'), {status: 409});
      }

      transaction.create(registrationRef, {
        tournamentId,
        userId: auth.uid,
        teamId: teamId || null,
        displayName: cleanString(req.body && req.body.displayName),
        phone: cleanString(req.body && req.body.phone),
        status: 'Registered',
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(tournamentRef, {
        registrationCount: registrationCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {registrationId, teamId: teamId || null, registrationCount: registrationCount + 1};
    });
    res.status(201).json({tournamentId, status: 'Registered', ...result});
  } catch (error) {
    console.error('registerTournamentPlayer error:', error);
    res.status(error.status || 500).json({error: error.message || 'Registration failed'});
  }
});

/**
 * Approve a vendor and atomically assign managed venues.
 * Super-admin only. POST body: {userId, venueId? | venueIds?, activateVenues?}
 */
exports.approveVendorVenue = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;
  if (!auth.isSuperAdmin) {
    res.status(403).json({error: 'Only super admins can approve and assign vendors'});
    return;
  }

  const userId = cleanString(req.body && req.body.userId);
  const requested = Array.isArray(req.body && req.body.venueIds) ?
    req.body.venueIds : [req.body && req.body.venueId];
  const venueIds = [...new Set(requested.map(cleanString).filter(Boolean))];
  if (!userId || venueIds.length === 0) {
    res.status(400).json({error: 'Required: userId and at least one venueId'});
    return;
  }

  try {
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const userRef = admin.firestore().collection('users').doc(userId);
      const venueRefs = venueIds.map((venueId) =>
        admin.firestore().collection('venues').doc(venueId));
      const userSnapshot = await transaction.get(userRef);
      const venueSnapshots = await Promise.all(venueRefs.map((ref) => transaction.get(ref)));

      if (!userSnapshot.exists) throw Object.assign(new Error('Vendor not found'), {status: 404});
      const user = userSnapshot.data();
      if (user.role !== 'venue_manager') {
        throw Object.assign(new Error('User is not a venue manager'), {status: 409});
      }
      const missingVenue = venueSnapshots.findIndex((snapshot) => !snapshot.exists);
      if (missingVenue !== -1) {
        throw Object.assign(new Error(`Venue not found: ${venueIds[missingVenue]}`), {status: 404});
      }

      const previousManagerIds = [...new Set(
        venueSnapshots
          .map((snapshot) => cleanString(snapshot.data().managerId))
          .filter((managerId) => managerId && managerId !== userId),
      )];
      const previousManagerRefs = previousManagerIds.map((managerId) =>
        admin.firestore().collection('users').doc(managerId));
      const previousManagerSnapshots = await Promise.all(
        previousManagerRefs.map((ref) => transaction.get(ref)),
      );

      const managedVenues = venueIds;
      transaction.update(userRef, {
        status: 'Active',
        managedVenues,
        approvedBy: auth.uid,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      previousManagerSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists) return;
        const previousManaged = Array.isArray(snapshot.data().managedVenues) ?
          snapshot.data().managedVenues : [];
        const reassignedVenueIds = venueSnapshots
          .filter((venueSnapshot) => venueSnapshot.data().managerId === snapshot.id)
          .map((venueSnapshot) => venueSnapshot.id);
        transaction.update(previousManagerRefs[index], {
          managedVenues: previousManaged.filter(
            (venueId) => !reassignedVenueIds.includes(venueId),
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      venueRefs.forEach((venueRef) => {
        const venueUpdate = {
          managerId: userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (!req.body || req.body.activateVenues !== false) venueUpdate.status = 'Active';
        transaction.update(venueRef, venueUpdate);
      });
      return {managedVenues};
    });
    res.json({userId, venueIds, status: 'Active', ...result});
  } catch (error) {
    console.error('approveVendorVenue error:', error);
    res.status(error.status || 500).json({error: error.message || 'Vendor approval failed'});
  }
});

// ---------------------------------------------------------------------------
// FCM HTTPS endpoints (admin-only)
// ---------------------------------------------------------------------------

const invalidFcmTokenCodes = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

async function deactivateInvalidFcmTokens(tokens, responses) {
  const invalidTokens = responses
    .map((response, index) =>
      !response.success && invalidFcmTokenCodes.has(response.error?.code) ?
        tokens[index] :
        null)
    .filter(Boolean);
  for (let index = 0; index < invalidTokens.length; index += 30) {
    const snapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('token', 'in', invalidTokens.slice(index, index + 30))
      .get();
    if (snapshot.empty) continue;
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((document) => {
      batch.update(document.ref, {
        isActive: false,
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

/**
 * Send push notification to multiple FCM tokens.
 * Requires `Authorization: Bearer <idToken>` (super_admin or venue_manager).
 * POST body: { notification: {title, body, imageUrl?}, data: {...}, tokens: string[] }
 */
exports.sendNotification = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const {notification, data, tokens} = req.body;
    if (!notification || !notification.title || !notification.body) {
      res.status(400).json({error: 'Missing required fields: notification.title and notification.body'});
      return;
    }
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({error: 'Missing or invalid tokens array'});
      return;
    }
    if (tokens.length > 500) {
      res.status(400).json({error: 'Too many tokens (max 500 per call)'});
      return;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: (data && data.type) || 'general',
        actionUrl: (data && data.actionUrl) || '',
        actionText: (data && data.actionText) || '',
        notificationId: (data && data.notificationId) || '',
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      tokens,
      android: {
        priority: 'high',
        notification: {sound: 'default', channelId: 'high_importance_channel'},
      },
      apns: {
        payload: {aps: {sound: 'default', badge: 1}},
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    await deactivateInvalidFcmTokens(tokens, response.responses);

    // Do NOT echo tokens back; use index-based references only.
    res.json({
      success: response.successCount,
      failed: response.failureCount,
      responses: response.responses.map((resp, idx) => ({
        index: idx,
        success: resp.success,
        error: resp.error ? resp.error.message : null,
      })),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({error: error.message || 'Internal server error'});
  }
});

/**
 * Send notification to a user by userId (looks up their active fcmTokens).
 * Requires `Authorization: Bearer <idToken>` (super_admin or venue_manager).
 */
exports.sendNotificationToUser = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const {userId, notification, data} = req.body;
    if (!userId || !notification || !notification.title || !notification.body) {
      res.status(400).json({error: 'Missing required fields: userId, notification.title, notification.body'});
      return;
    }

    const tokensSnapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      res.status(404).json({error: 'No active FCM tokens found for user'});
      return;
    }

    const tokens = tokensSnapshot.docs.map((doc) => doc.data().token).filter(Boolean);
    if (tokens.length === 0) {
      res.status(404).json({error: 'No valid FCM tokens found for user'});
      return;
    }

    const notificationDoc = await admin.firestore().collection('notifications').add({
      userId,
      title: notification.title,
      body: notification.body,
      type: (data && data.type) || 'general',
      data: data || {},
      isRead: false,
      // Legacy mobile builds still read `read`; new code should use `isRead`.
      read: false,
      createdBy: auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: (data && data.type) || 'general',
        id: (data && data.id) || notificationDoc.id,
        notificationId: notificationDoc.id,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      tokens,
      android: {
        priority: 'high',
        notification: {sound: 'default', channelId: 'high_importance_channel'},
      },
      apns: {
        payload: {aps: {sound: 'default', badge: 1}},
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    await deactivateInvalidFcmTokens(tokens, response.responses);

    res.json({
      success: response.successCount,
      failed: response.failureCount,
      notificationId: notificationDoc.id,
      tokensSent: tokens.length,
    });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({error: error.message || 'Internal server error'});
  }
});

/**
 * Send notification to an FCM topic.
 * Requires `Authorization: Bearer <idToken>` (super_admin or venue_manager).
 */
exports.sendNotificationToTopic = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const {topic, notification, data} = req.body;
    if (!topic || !notification || !notification.title || !notification.body) {
      res.status(400).json({error: 'Missing required fields: topic, notification.title, notification.body'});
      return;
    }
    // Validate topic format per FCM rules ([a-zA-Z0-9-_.~%]+)
    if (!/^[a-zA-Z0-9\-_.~%]+$/.test(topic)) {
      res.status(400).json({error: 'Invalid topic name'});
      return;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: (data && data.type) || 'general',
        id: (data && data.id) || '',
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      topic,
      android: {
        priority: 'high',
        notification: {sound: 'default', channelId: 'high_importance_channel'},
      },
      apns: {
        payload: {aps: {sound: 'default', badge: 1}},
      },
    };

    const response = await admin.messaging().send(message);
    res.json({success: true, messageId: response});
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    res.status(500).json({error: error.message || 'Internal server error'});
  }
});

async function resolveNotificationAudience(notification) {
  const audience = notification.targetAudience;
  if (audience === 'Specific Users') {
    return [...new Set(notification.targetUserIds || [])].filter(Boolean);
  }
  if (audience === 'Venue Managers') {
    const managers = await admin.firestore().collection('users')
      .where('role', '==', 'venue_manager').get();
    return managers.docs.map((document) => document.id);
  }
  if (audience === 'Venue Users' && notification.targetVenueId) {
    const venueId = notification.targetVenueId;
    const [bookings, venueUsers, venueManagers] = await Promise.all([
      admin.firestore().collection('bookings')
        .where('venueId', '==', venueId).get(),
      admin.firestore().collection('users')
        .where('venueIds', 'array-contains', venueId).get(),
      admin.firestore().collection('users')
        .where('managedVenues', 'array-contains', venueId).get(),
    ]);
    return [...new Set([
      ...bookings.docs.map((document) => document.data().userId),
      ...venueUsers.docs.map((document) => document.id),
      ...venueManagers.docs.map((document) => document.id),
    ])].filter(Boolean);
  }
  if (audience === 'All Users') {
    const users = await admin.firestore().collection('users').get();
    return users.docs.map((document) => document.id);
  }
  return [];
}

async function dispatchStoredNotification(notificationDocument) {
  const notification = notificationDocument.data();
  const creator = notification.createdBy ?
    await admin.firestore().collection('users').doc(notification.createdBy).get() :
    null;
  const creatorData = creator?.data() || {};
  if (creatorData.role !== 'super_admin' &&
      ['All Users', 'Venue Managers'].includes(notification.targetAudience)) {
    throw new Error('Only super admins can send to this audience');
  }
  if (creatorData.role !== 'super_admin' &&
      notification.targetAudience === 'Venue Users' &&
      !(creatorData.managedVenues || []).includes(notification.targetVenueId)) {
    throw new Error('Notification venue is outside the sender scope');
  }

  const userIds = await resolveNotificationAudience(notification);
  const writer = admin.firestore().bulkWriter();
  userIds.forEach((userId) => {
    const recipientRef = admin.firestore().collection('notifications')
      .doc(`${notificationDocument.id}_${userId}`);
    writer.set(recipientRef, {
      userId,
      title: notification.title,
      body: notification.body,
      type: notification.type || 'general',
      read: false,
      isRead: false,
      actionUrl: notification.actionUrl || null,
      actionText: notification.actionText || null,
      imageUrl: notification.imageUrl || null,
      sourceNotificationId: notificationDocument.id,
      createdBy: notification.createdBy || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  });
  await writer.close();

  const tokenDocuments = [];
  for (let index = 0; index < userIds.length; index += 30) {
    const tokenSnapshot = await admin.firestore().collection('fcmTokens')
      .where('userId', 'in', userIds.slice(index, index + 30))
      .where('isActive', '==', true)
      .get();
    tokenDocuments.push(...tokenSnapshot.docs);
  }
  const uniqueTokens = [...new Set(
    tokenDocuments.map((document) => document.data().token).filter(Boolean),
  )];
  let successCount = 0;
  let failureCount = 0;
  for (let index = 0; index < uniqueTokens.length; index += 500) {
    const tokens = uniqueTokens.slice(index, index + 500);
    const response = await admin.messaging().sendEachForMulticast({
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && {imageUrl: notification.imageUrl}),
      },
      data: {
        type: String(notification.type || 'general'),
        actionUrl: String(notification.actionUrl || ''),
        actionText: String(notification.actionText || ''),
        notificationId: notificationDocument.id,
      },
      tokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel',
        },
      },
      apns: {payload: {aps: {sound: 'default', badge: 1}}},
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    await deactivateInvalidFcmTokens(tokens, response.responses);
  }

  await notificationDocument.ref.update({
    status: userIds.length > 0 ? 'Sent' : 'Failed',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentCount: Math.max(successCount, userIds.length),
    pushSentCount: successCount,
    failedCount: failureCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.processScheduledNotifications = onSchedule(
  {schedule: 'every 1 minutes', timeZone: 'Asia/Kolkata'},
  async () => {
    const due = await admin.firestore().collection('notifications')
      .where('status', '==', 'Scheduled')
      .where('scheduledFor', '<=', admin.firestore.Timestamp.now())
      .orderBy('scheduledFor')
      .limit(100)
      .get();
    for (const notificationDocument of due.docs) {
      try {
        const claimed = await admin.firestore().runTransaction(async (transaction) => {
          const current = await transaction.get(notificationDocument.ref);
          if (!current.exists || current.data().status !== 'Scheduled') {
            return false;
          }
          transaction.update(notificationDocument.ref, {
            status: 'Sending',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return true;
        });
        if (!claimed) continue;
        await dispatchStoredNotification(notificationDocument);
      } catch (error) {
        console.error(
          'Scheduled notification failed:',
          notificationDocument.id,
          error,
        );
        await notificationDocument.ref.update({
          status: 'Failed',
          error: String(error.message || error).slice(0, 500),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  },
);

// ---------------------------------------------------------------------------
// Firestore triggers
// ---------------------------------------------------------------------------

function venueTopic(venueId) {
  const normalized = String(venueId || '').replace(/[^a-zA-Z0-9\-_.~%]/g, '_');
  return normalized ? `venue_${normalized}` : null;
}

async function sendVenueEventNotification(event, kind, documentId, before, after) {
  const venueId = cleanString(after.venueId);
  const topic = venueTopic(venueId);
  if (!topic) {
    console.log(`${kind} ${documentId} has no venueId; notification skipped`);
    return null;
  }

  const isTournament = kind === 'tournament';
  const title = isTournament ?
    (before ? 'Tournament updated' : 'New tournament') :
    (before ? 'Quick match updated' : 'New quick match');
  const name = cleanString(after.name) || cleanString(after.sport) ||
    (isTournament ? 'Tournament' : 'Quick match');
  const body = `${name} at ${after.venueName || 'your venue'} is ${after.status || 'available'}.`;
  const markerId = crypto.createHash('sha256')
    .update(`${event.id}:${kind}:${documentId}`)
    .digest('hex');
  const markerRef = admin.firestore().collection('systemNotificationEvents').doc(markerId);
  const notificationRef = admin.firestore().collection('notifications').doc(markerId);

  const shouldSend = await admin.firestore().runTransaction(async (transaction) => {
    const marker = await transaction.get(markerRef);
    if (marker.exists) return false;
    transaction.create(markerRef, {
      eventId: event.id,
      kind,
      sourceId: documentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(notificationRef, {
      title,
      body,
      type: kind,
      targetAudience: 'Venue',
      targetVenueId: venueId,
      data: {[`${kind}Id`]: documentId, venueId},
      isRead: false,
      read: false,
      source: 'system',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!shouldSend) return null;

  return admin.messaging().send({
    notification: {title, body},
    data: {
      type: kind,
      id: documentId,
      [`${kind}Id`]: documentId,
      venueId,
      notificationId: markerId,
    },
    topic,
    android: {
      priority: 'high',
      notification: {sound: 'default', channelId: 'high_importance_channel'},
    },
    apns: {payload: {aps: {sound: 'default', badge: 1}}},
  });
}

function relevantEventUpdate(kind, before, after) {
  const dateField = kind === 'tournament' ? 'startDate' : 'date';
  const beforeDate = asDate(before[dateField]);
  const afterDate = asDate(after[dateField]);
  return before.status !== after.status ||
    before.venueId !== after.venueId ||
    before.name !== after.name ||
    before.sport !== after.sport ||
    (beforeDate ? beforeDate.getTime() : null) !==
      (afterDate ? afterDate.getTime() : null);
}

exports.onQuickMatchCreated = onDocumentCreated('quickMatches/{matchId}', async (event) => {
  const match = event.data.data();
  if (!['Open', 'Full'].includes(match.status)) return null;
  return sendVenueEventNotification(event, 'quickMatch', event.params.matchId, null, match);
});

exports.onQuickMatchUpdated = onDocumentUpdated('quickMatches/{matchId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!relevantEventUpdate('quickMatch', before, after)) return null;
  return sendVenueEventNotification(event, 'quickMatch', event.params.matchId, before, after);
});

exports.onTournamentCreated = onDocumentCreated('tournaments/{tournamentId}', async (event) => {
  const tournament = event.data.data();
  if (tournament.status !== 'Open') return null;
  return sendVenueEventNotification(
    event, 'tournament', event.params.tournamentId, null, tournament);
});

exports.onTournamentUpdated = onDocumentUpdated('tournaments/{tournamentId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!relevantEventUpdate('tournament', before, after)) return null;
  return sendVenueEventNotification(
    event, 'tournament', event.params.tournamentId, before, after);
});

async function bookingNotificationAllowed(userId) {
  const [settingsDocument, userDocument] = await Promise.all([
    admin.firestore().collection('appSettings').doc('platform').get(),
    admin.firestore().collection('users').doc(userId).get(),
  ]);
  if (settingsDocument.exists &&
      settingsDocument.data().enableBookingNotifications === false) {
    return false;
  }
  return userDocument.data()?.notificationSettings?.booking !== false;
}

/** Send notification when a booking is created. */
exports.onBookingCreated = onDocumentCreated(
  'bookings/{bookingId}',
  async (event) => {
    try {
      const booking = event.data.data();
      const userId = booking.userId;
      if (!userId) return null;

      // Only Confirmed bookings get a confirmation message here; Pending
      // bookings are notified by onBookingStatusChanged when accepted.
      if (booking.status !== 'Confirmed') {
        console.log('Booking created with status', booking.status, '- skipping confirmation notification');
        return null;
      }
      if (!await bookingNotificationAllowed(userId)) return null;

      // Persist the inbox notification even when the user has no push token.
      const notificationDoc = await admin.firestore().collection('notifications').add({
        userId,
        title: 'Booking Confirmed!',
        body: `Your booking at ${booking.venueName || 'venue'} has been confirmed.`,
        type: 'booking',
        data: {bookingId: event.params.bookingId},
        isRead: false,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const tokensSnapshot = await admin.firestore()
        .collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens for user:', userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      const message = {
        notification: {
          title: 'Booking Confirmed!',
          body: `Your booking at ${booking.venueName || 'venue'} has been confirmed.`,
        },
        data: {
          type: 'booking',
          id: event.params.bookingId,
          bookingId: event.params.bookingId,
          notificationId: notificationDoc.id,
        },
        tokens,
        android: {priority: 'high', notification: {sound: 'default', channelId: 'high_importance_channel'}},
        apns: {payload: {aps: {sound: 'default', badge: 1}}},
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      await deactivateInvalidFcmTokens(tokens, response.responses);
      console.log('Notification sent for booking:', event.params.bookingId);
    } catch (error) {
      console.error('Error in onBookingCreated:', error);
      // Allow default Cloud Functions retry semantics for transient errors by rethrowing.
      throw error;
    }
    return null;
  },
);

/** Send notification when a booking's status changes. */
exports.onBookingStatusChanged = onDocumentUpdated(
  'bookings/{bookingId}',
  async (event) => {
    try {
      const before = event.data.before.data();
      const after = event.data.after.data();
      const userId = after.userId;
      if (!userId || before.status === after.status) return null;

      let title = '';
      let body = '';
      let type = 'booking';
      switch (after.status) {
        case 'Confirmed':
          title = 'Booking Confirmed!';
          body = `Your booking at ${after.venueName || 'venue'} has been confirmed.`;
          break;
        case 'Cancelled':
          title = 'Booking Cancelled';
          body = `Your booking at ${after.venueName || 'venue'} has been cancelled.`;
          type = 'booking_cancelled';
          break;
        case 'Completed':
          title = 'Booking Completed';
          body = `Your booking at ${after.venueName || 'venue'} has been completed.`;
          type = 'booking_completed';
          break;
        default:
          return null;
      }
      if (!await bookingNotificationAllowed(userId)) return null;

      const notificationDoc = await admin.firestore().collection('notifications').add({
        userId,
        title,
        body,
        type,
        data: {bookingId: event.params.bookingId},
        isRead: false,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const tokensSnapshot = await admin.firestore()
        .collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensSnapshot.empty) {
        console.log('No active FCM tokens for user:', userId);
        return null;
      }

      const tokens = tokensSnapshot.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length === 0) return null;

      const message = {
        notification: {title, body},
        data: {
          type,
          id: event.params.bookingId,
          bookingId: event.params.bookingId,
          notificationId: notificationDoc.id,
        },
        tokens,
        android: {priority: 'high', notification: {sound: 'default', channelId: 'high_importance_channel'}},
        apns: {payload: {aps: {sound: 'default', badge: 1}}},
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      await deactivateInvalidFcmTokens(tokens, response.responses);
      console.log('Notification sent for booking status change:', event.params.bookingId);
    } catch (error) {
      console.error('Error in onBookingStatusChanged:', error);
      throw error;
    }
    return null;
  },
);

/** Maintain a privacy-safe availability projection for player slot searches. */
exports.syncCourtAvailability = onDocumentWritten(
  'bookings/{bookingId}',
  async (event) => {
    const before = event.data && event.data.before.exists ?
      event.data.before.data() :
      null;
    const after = event.data && event.data.after.exists ?
      event.data.after.data() :
      null;
    const bookingId = event.params.bookingId;
    const availabilityRef = admin.firestore()
      .collection('courtAvailability')
      .doc(bookingId);
    const activeStatuses = new Set(['Pending', 'Confirmed', 'Processing']);

    if (after &&
        activeStatuses.has(after.status) &&
        after.venueId &&
        after.courtId &&
        after.startTime &&
        after.endTime) {
      await availabilityRef.set({
        bookingId,
        venueId: after.venueId,
        courtId: after.courtId,
        startTime: after.startTime,
        endTime: after.endTime,
        status: after.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    }

    const writes = [availabilityRef.delete()];
    const slotLockId = (after && after.slotLockId) || (before && before.slotLockId);
    if (slotLockId) {
      writes.push(admin.firestore().collection('booking_slot_locks').doc(slotLockId).delete());
    }
    await Promise.all(writes);
    return null;
  },
);

/** Keep post moderation counters in sync when a player submits a report. */
exports.onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  const report = event.data && event.data.data();
  const postId = cleanString(report && report.postId);
  if (!postId) return null;
  const postRef = admin.firestore().collection('posts').doc(postId);
  const post = await postRef.get();
  if (!post.exists) return null;
  await postRef.set({
    isReported: true,
    reportCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return null;
});

// ---------------------------------------------------------------------------
// Razorpay orders and webhooks
// ---------------------------------------------------------------------------

function getRazorpayCredentials() {
  // firebase-functions v7 removed functions.config(); use .env / Secret Manager only.
  return {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  };
}

/**
 * Create a server-trusted Razorpay order for a player wallet top-up.
 * POST body: {amount} where amount is whole INR rupees.
 */
exports.createWalletTopUpOrder = functions.https.onRequest(async (req, res) => {
  const auth = await requireAuthenticatedPost(req, res);
  if (!auth) return;

  const amount = Number(req.body && req.body.amount);
  if (!Number.isInteger(amount) || amount < 10 || amount > 50000) {
    res.status(400).json({error: 'Enter an amount between ₹10 and ₹50,000.'});
    return;
  }
  const {keyId, keySecret} = getRazorpayCredentials();
  if (!keyId || !keySecret) {
    res.status(503).json({error: 'Wallet payments are not configured.'});
    return;
  }

  const topUpRef = admin.firestore().collection('walletTopups').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await topUpRef.set({
    userId: auth.uid,
    ownerId: auth.uid,
    amount,
    expectedAmountPaise: amount * 100,
    currency: 'INR',
    status: 'Creating',
    createdAt: now,
    updatedAt: now,
  });

  try {
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: 'INR',
        receipt: `wallet_${topUpRef.id}`,
        notes: {
          walletTopupId: topUpRef.id,
          userId: auth.uid,
          sourceType: 'Wallet',
          sourceId: topUpRef.id,
          venueId: 'platform',
        },
      }),
    });
    const order = await razorpayResponse.json().catch(() => ({}));
    if (!razorpayResponse.ok || !order.id) {
      throw new Error(order.error?.description || 'Razorpay order creation failed');
    }
    await topUpRef.update({
      status: 'Pending',
      razorpayOrderId: order.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({
      topUpId: topUpRef.id,
      orderId: order.id,
      keyId,
      amount,
      amountPaise: amount * 100,
      currency: 'INR',
    });
  } catch (error) {
    await topUpRef.set({
      status: 'Failed',
      failureReason: error.message || 'Order creation failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    console.error('createWalletTopUpOrder failed:', error);
    res.status(502).json({error: 'Could not start the wallet payment.'});
  }
});

/**
 * Razorpay webhooks — verifies HMAC-SHA256 of the raw body using the configured secret.
 * Set env `RAZORPAY_WEBHOOK_SECRET` in functions/.env (or Secret Manager).
 * Register this URL in Razorpay Dashboard → Webhooks.
 */
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  // Webhooks do not use CORS; respond minimally and do not echo origins.
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret) {
    console.warn('razorpay webhook_secret not set (env RAZORPAY_WEBHOOK_SECRET)');
    res.status(503).json({error: 'Webhook secret not configured'});
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sig = req.get('x-razorpay-signature') || '';

  // Constant-time comparison to avoid signature timing attacks.
  let signatureOk = false;
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig, 'hex');
    signatureOk = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    signatureOk = false;
  }
  if (!signatureOk) {
    res.status(400).json({error: 'Invalid signature'});
    return;
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      res.status(400).json({error: 'Invalid JSON'});
      return;
    }
  }

  const event = payload && payload.event;
  const now = admin.firestore.FieldValue.serverTimestamp();
  try {
    const razorpayPayload = payload && payload.payload || {};
    const paymentEntity = razorpayPayload.payment && razorpayPayload.payment.entity;
    const orderEntity = razorpayPayload.order && razorpayPayload.order.entity;
    const refundEntity = razorpayPayload.refund && razorpayPayload.refund.entity;
    const entity = paymentEntity || orderEntity || refundEntity || {};
    const notes = {
      ...((orderEntity && orderEntity.notes) || {}),
      ...((paymentEntity && paymentEntity.notes) || {}),
      ...((refundEntity && refundEntity.notes) || {}),
    };
    let bookingId = cleanString(notes.bookingId);
    let membershipId = cleanString(notes.membershipId);
    let settlementId = cleanString(notes.settlementId);
    let marketplaceOrderId = cleanString(notes.orderId);
    let walletTopupId = cleanString(notes.walletTopupId);
    const paymentId = cleanString(paymentEntity && paymentEntity.id) ||
      cleanString(refundEntity && refundEntity.payment_id);
    const razorpayOrderId = cleanString(paymentEntity && paymentEntity.order_id) ||
      cleanString(orderEntity && orderEntity.id);
    const paymentDocumentId = paymentId ||
      (razorpayOrderId && `razorpay_order_${razorpayOrderId}`) ||
      (marketplaceOrderId && `order_${marketplaceOrderId}`);
    let existingPayment = {};
    if (paymentDocumentId && !bookingId && !membershipId && !settlementId) {
      const existingSnapshot = await admin.firestore()
        .collection('payments')
        .doc(paymentDocumentId)
        .get();
      existingPayment = existingSnapshot.exists ? existingSnapshot.data() : {};
      bookingId = cleanString(existingPayment.bookingId);
      membershipId = cleanString(existingPayment.membershipId);
      settlementId = cleanString(existingPayment.settlementId);
      marketplaceOrderId = cleanString(existingPayment.orderId);
      walletTopupId = cleanString(existingPayment.walletTopupId);
    }
    const amountPaise = Number(entity.amount || entity.amount_paid || 0);
    const amountRefundedPaise = Number(
      (refundEntity && refundEntity.amount) || (paymentEntity && paymentEntity.amount_refunded) || 0);

    const notedSourceType = cleanString(notes.sourceType);
    const existingSourceType = cleanString(existingPayment.sourceType);
    let sourceType = ['Booking', 'Membership', 'Settlement', 'Order', 'Wallet']
      .includes(notedSourceType) ?
      notedSourceType :
      (['Booking', 'Membership', 'Settlement', 'Order', 'Wallet']
        .includes(existingSourceType) ?
        existingSourceType : null);
    let sourceId = cleanString(notes.sourceId) || cleanString(existingPayment.sourceId);
    let sourceData = {};
    let sourceCollection = null;
    if (bookingId) {
      sourceType = 'Booking';
      sourceId = bookingId;
      sourceCollection = 'bookings';
    } else if (membershipId) {
      sourceType = 'Membership';
      sourceId = membershipId;
      sourceCollection = 'memberships';
    } else if (settlementId) {
      sourceType = 'Settlement';
      sourceId = settlementId;
      sourceCollection = 'settlements';
    } else if (marketplaceOrderId) {
      sourceType = 'Order';
      sourceId = marketplaceOrderId;
      sourceCollection = 'orders';
    } else if (walletTopupId) {
      sourceType = 'Wallet';
      sourceId = walletTopupId;
      sourceCollection = 'walletTopups';
    } else if (sourceType && sourceId) {
      sourceCollection = {
        Booking: 'bookings',
        Membership: 'memberships',
        Settlement: 'settlements',
        Order: 'orders',
        Wallet: 'walletTopups',
      }[sourceType] || null;
    }
    if (!bookingId && sourceType === 'Booking') bookingId = sourceId;
    if (!membershipId && sourceType === 'Membership') membershipId = sourceId;
    if (!settlementId && sourceType === 'Settlement') settlementId = sourceId;
    if (!marketplaceOrderId && sourceType === 'Order') marketplaceOrderId = sourceId;
    if (!walletTopupId && sourceType === 'Wallet') walletTopupId = sourceId;
    if (sourceCollection && sourceId) {
      const sourceSnapshot = await admin.firestore()
        .collection(sourceCollection)
        .doc(sourceId)
        .get();
      sourceData = sourceSnapshot.exists ? sourceSnapshot.data() : {};
    }
    const userId = cleanString(notes.userId) || cleanString(sourceData.userId) ||
      cleanString(existingPayment.userId);
    const venueId = cleanString(notes.venueId) || cleanString(sourceData.venueId) ||
      cleanString(existingPayment.venueId);
    const transactionId = paymentId || cleanString(entity.id);
    const canWritePayment = paymentDocumentId && sourceType && sourceId && venueId;
    if (paymentDocumentId && !canWritePayment) {
      console.warn('Razorpay event lacks Payment schema source/venue metadata', {
        event,
        paymentDocumentId,
        razorpayOrderId,
        marketplaceOrderId,
      });
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      if (bookingId) {
        await admin.firestore().collection('bookings').doc(bookingId).set({
          status: 'Confirmed',
          paymentStatus: 'Paid',
          paymentTransactionId: transactionId,
          razorpayOrderId,
          webhookVerifiedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      if (membershipId) {
        await admin.firestore().collection('memberships').doc(membershipId).set({
          status: 'Active',
          paymentStatus: 'Paid',
          paymentMethod: 'Online',
          paymentGateway: 'Razorpay',
          paymentTransactionId: transactionId,
          paymentDate: now,
          razorpayOrderId,
          webhookVerifiedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      if (marketplaceOrderId) {
        await admin.firestore().collection('orders').doc(marketplaceOrderId).set({
          paymentStatus: 'Paid',
          paymentTransactionId: transactionId,
          razorpayOrderId,
          status: 'Processing',
          webhookVerifiedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      if (walletTopupId) {
        const topUpRef = admin.firestore().collection('walletTopups').doc(walletTopupId);
        const userRef = userId && admin.firestore().collection('users').doc(userId);
        const transactionRef = paymentDocumentId &&
          admin.firestore().collection('walletTransactions').doc(paymentDocumentId);
        if (!userRef || !transactionRef) {
          throw new Error('Wallet payment is missing user or transaction metadata');
        }
        await admin.firestore().runTransaction(async (transaction) => {
          const topUpSnapshot = await transaction.get(topUpRef);
          if (!topUpSnapshot.exists) throw new Error('Wallet top-up not found');
          const topUp = topUpSnapshot.data();
          if (topUp.status === 'Completed') return;
          if (topUp.userId !== userId ||
              topUp.razorpayOrderId !== razorpayOrderId ||
              Number(topUp.amount) * 100 !== amountPaise) {
            throw new Error('Wallet top-up verification failed');
          }
          const userSnapshot = await transaction.get(userRef);
          const currentBalance = Number(userSnapshot.data()?.walletBalance || 0);
          const newBalance = currentBalance + Number(topUp.amount);
          transaction.set(userRef, {
            walletBalance: newBalance,
            updatedAt: now,
          }, {merge: true});
          transaction.update(topUpRef, {
            status: 'Completed',
            paymentTransactionId: transactionId,
            webhookVerifiedAt: now,
            updatedAt: now,
          });
          transaction.set(transactionRef, {
            userId,
            type: 'Credit',
            amount: Number(topUp.amount),
            balanceAfter: newBalance,
            description: 'Wallet top-up',
            paymentGateway: 'Razorpay',
            paymentTransactionId: transactionId,
            razorpayOrderId,
            status: 'Completed',
            createdAt: now,
            updatedAt: now,
          }, {merge: true});
        });
      }
      // Record a Payment-schema document. The Razorpay payment ID is the
      // idempotency key; order-only events use a stable order-prefixed key.
      if (canWritePayment) {
        await admin.firestore().collection('payments').doc(paymentDocumentId).set({
          type: 'Online',
          direction: sourceType === 'Wallet' ? 'UserToPlatform' : 'UserToVenue',
          sourceType,
          sourceId,
          userId,
          venueId,
          amount: amountPaise / 100,
          currency: (entity && entity.currency) || 'INR',
          paymentMethod: 'Razorpay',
          paymentGateway: 'Razorpay',
          transactionId,
          orderId: marketplaceOrderId,
          razorpayOrderId,
          bookingId,
          membershipId,
          settlementId,
          walletTopupId,
          status: 'Completed',
          paymentDate: now,
          rawEvent: event,
          createdAt: now,
          updatedAt: now,
        }, {merge: true});
      }
    } else if (event === 'payment.failed') {
      if (bookingId) {
        const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();
        await bookingRef.set({
          status: 'Cancelled',
          paymentStatus: 'Failed',
          paymentFailedAt: now,
          updatedAt: now,
        }, {merge: true});
        const slotLockId = bookingSnap.data()?.slotLockId;
        if (slotLockId) {
          await admin.firestore().collection('booking_slot_locks').doc(slotLockId).delete();
        }
      }
      if (membershipId) {
        await admin.firestore().collection('memberships').doc(membershipId).set({
          status: 'Cancelled',
          paymentStatus: 'Failed',
          paymentFailedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      if (marketplaceOrderId) {
        await admin.firestore().collection('orders').doc(marketplaceOrderId).set({
          status: 'Cancelled',
          paymentStatus: 'Failed',
          paymentFailedAt: now,
          updatedAt: now,
        }, {merge: true});
      }
      if (walletTopupId) {
        await admin.firestore().collection('walletTopups').doc(walletTopupId).set({
          status: 'Failed',
          failureReason: cleanString(
            paymentEntity && paymentEntity.error_description,
          ) || 'Payment failed',
          updatedAt: now,
        }, {merge: true});
      }
      if (canWritePayment) {
        await admin.firestore().collection('payments').doc(paymentDocumentId).set({
          type: 'Online',
          direction: sourceType === 'Wallet' ? 'UserToPlatform' : 'UserToVenue',
          sourceType,
          sourceId,
          userId,
          venueId,
          amount: amountPaise / 100,
          currency: entity.currency || 'INR',
          paymentMethod: 'Razorpay',
          paymentGateway: 'Razorpay',
          transactionId,
          orderId: marketplaceOrderId,
          walletTopupId,
          razorpayOrderId,
          status: 'Failed',
          rawEvent: event,
          createdAt: now,
          updatedAt: now,
        }, {merge: true});
      }
    } else if (event === 'refund.created' || event === 'refund.processed') {
      if (bookingId) {
        await admin.firestore().collection('bookings').doc(bookingId).set({
          paymentStatus: 'Refunded',
          updatedAt: now,
        }, {merge: true});
      }
      if (membershipId) {
        await admin.firestore().collection('memberships').doc(membershipId).set({
          paymentStatus: 'Refunded',
          updatedAt: now,
        }, {merge: true});
      }
      if (marketplaceOrderId) {
        await admin.firestore().collection('orders').doc(marketplaceOrderId).set({
          paymentStatus: 'Refunded',
          status: 'Refunded',
          updatedAt: now,
        }, {merge: true});
      }
      if (canWritePayment) {
        await admin.firestore().collection('payments').doc(paymentDocumentId).set({
          type: 'Online',
          direction: 'UserToVenue',
          sourceType,
          sourceId,
          userId,
          venueId,
          paymentMethod: 'Razorpay',
          paymentGateway: 'Razorpay',
          transactionId,
          orderId: marketplaceOrderId,
          razorpayOrderId,
          bookingId,
          membershipId,
          settlementId,
          amountRefunded: amountRefundedPaise / 100,
          status: 'Refunded',
          rawEvent: event,
          updatedAt: now,
        }, {merge: true});
      }
    }
  } catch (err) {
    console.error('razorpayWebhook handler error:', err);
    res.status(500).json({error: err.message || 'Handler error'});
    return;
  }

  res.json({received: true});
});

// ---------------------------------------------------------------------------
// User account provisioning (admin-only)
// ---------------------------------------------------------------------------

function generateTempPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

async function deleteDuplicateUserDocs(email, keepUid) {
  const snap = await admin.firestore()
    .collection('users')
    .where('email', '==', email)
    .get();
  const batch = admin.firestore().batch();
  let deleted = 0;
  snap.docs.forEach((doc) => {
    if (doc.id !== keepUid) {
      batch.delete(doc.ref);
      deleted++;
    }
  });
  if (deleted > 0) {
    await batch.commit();
  }
  return deleted;
}

async function writeUserProfile(uid, profile) {
  await admin.firestore().collection('users').doc(uid).set({
    ...profile,
    id: uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

function getFirebaseWebApiKey() {
  return process.env.WEB_API_KEY ||
    process.env.FIREBASE_WEB_API_KEY ||
    '';
}

function getAdminPanelLoginUrl() {
  return process.env.ADMIN_PANEL_URL || '';
}

/** Send password-reset email via Firebase Identity Toolkit REST API. */
async function sendPasswordResetEmailViaApi(email) {
  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) {
    return {sent: false, reason: 'missing_api_key'};
  }

  const continueUrl = getAdminPanelLoginUrl();
  const body = {
    requestType: 'PASSWORD_RESET',
    email,
  };
  if (continueUrl) {
    body.continueUrl = continueUrl.replace(/\/$/, '') + '/#/set-password';
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.error?.message || `sendOobCode failed (${response.status})`;
    throw new Error(message);
  }

  return {sent: true};
}

/** Generate a password-reset link as fallback when email delivery fails. */
async function generatePasswordResetLink(email) {
  const continueUrl = getAdminPanelLoginUrl();
  const actionCodeSettings = continueUrl ? {
    url: continueUrl.replace(/\/$/, '') + '/#/login',
    handleCodeInApp: false,
  } : undefined;

  return admin.auth().generatePasswordResetLink(email, actionCodeSettings);
}

/**
 * Create Firebase Auth account + Firestore user profile at the Auth UID.
 * Requires an admin role (super_admin, venue_manager, or custom admin role).
 * POST body: { name, email, phone, role, status, managedVenues?, customPermissions? }
 */
exports.createUserAccount = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const authCtx = await requireAdmin(req, res);
  if (!authCtx) return;

  try {
    const {name, email, phone, role, status, managedVenues, customPermissions} = req.body || {};
    if (!name || !email || !phone) {
      res.status(400).json({error: 'Missing required fields: name, email, phone'});
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const userRole = role || 'player';
    const userStatus = status || 'Active';

    // Non-super-admin callers (venue managers and custom admin roles) may
    // only create vendor accounts, never super admins or custom-role admins.
    if (!authCtx.isSuperAdmin) {
      if (userRole === 'super_admin') {
        res.status(403).json({error: 'Only super admins can create super admin users'});
        return;
      }
      if (userRole !== 'venue_manager') {
        res.status(403).json({error: 'Only super admins can assign this role'});
        return;
      }
    }

    // Non-super-admin callers may only grant venues they themselves manage;
    // otherwise they could hand out access to arbitrary venues.
    let allowedVenues = Array.isArray(managedVenues) ? managedVenues : [];
    if (!authCtx.isSuperAdmin) {
      const callerVenues = Array.isArray(authCtx.userData?.managedVenues) ?
        authCtx.userData.managedVenues : [];
      allowedVenues = allowedVenues.filter((venueId) => callerVenues.includes(venueId));
    }

    // Venue-scoped roles (venue_manager + custom admin roles) keep venue
    // assignments; players and super admins do not.
    const isScopedAdminRole = userRole !== 'player' && userRole !== 'super_admin';

    // Custom permission grants can only be handed out by super admins.
    const grantedPermissions =
      authCtx.isSuperAdmin && isScopedAdminRole && Array.isArray(customPermissions) ?
        customPermissions.filter((p) => typeof p === 'string') : [];

    const profile = {
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      role: userRole,
      status: userStatus,
      managedVenues: isScopedAdminRole ? allowedVenues : [],
      customPermissions: grantedPermissions,
    };

    let userRecord;
    let existingAuth = false;
    try {
      userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      existingAuth = true;
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    if (!userRecord) {
      userRecord = await admin.auth().createUser({
        email: normalizedEmail,
        password: generateTempPassword(),
        displayName: profile.name,
        emailVerified: false,
      });
    }

    const uid = userRecord.uid;
    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    await writeUserProfile(uid, {...profile, createdAt});
    const migratedCount = await deleteDuplicateUserDocs(normalizedEmail, uid);

    // Mirror managedVenues onto venues.managerId so staff/ownership filters work.
    if (isScopedAdminRole && allowedVenues.length > 0) {
      const batch = admin.firestore().batch();
      allowedVenues.forEach((venueId) => {
        batch.update(admin.firestore().collection('venues').doc(venueId), {
          managerId: uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    res.json({
      uid,
      email: normalizedEmail,
      existingAuth,
      migrated: migratedCount > 0,
    });
  } catch (error) {
    console.error('createUserAccount error:', error);
    res.status(500).json({error: error.message || 'Failed to create user account'});
  }
});

/**
 * Provision login for an existing Firestore user (creates Auth account + migrates doc ID).
 * Requires super_admin or venue_manager.
 * POST body: { userId }
 */
exports.provisionUserLogin = functions.https.onRequest(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed. Use POST.'});
    return;
  }

  const authCtx = await requireAdmin(req, res);
  if (!authCtx) return;

  try {
    const {userId, sendEmail} = req.body || {};
    if (!userId) {
      res.status(400).json({error: 'Missing required field: userId'});
      return;
    }

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({error: 'User profile not found'});
      return;
    }

    const userData = userDoc.data();
    const normalizedEmail = String(userData.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      res.status(400).json({error: 'User profile has no email address'});
      return;
    }

    if (!authCtx.isSuperAdmin && userData.role === 'super_admin') {
      res.status(403).json({error: 'Insufficient privileges for this user'});
      return;
    }

    let userRecord;
    let existingAuth = false;
    try {
      userRecord = await admin.auth().getUserByEmail(normalizedEmail);
      existingAuth = true;
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    if (!userRecord) {
      userRecord = await admin.auth().createUser({
        email: normalizedEmail,
        password: generateTempPassword(),
        displayName: userData.name || normalizedEmail,
        emailVerified: false,
      });
    }

    const uid = userRecord.uid;
    const migrated = userId !== uid;

    await writeUserProfile(uid, {
      ...userData,
      email: normalizedEmail,
      createdAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    });

    if (migrated) {
      await admin.firestore().collection('users').doc(userId).delete();
    }

    await deleteDuplicateUserDocs(normalizedEmail, uid);

    let emailSent = false;
    let resetLink = null;
    if (sendEmail !== false) {
      try {
        const emailResult = await sendPasswordResetEmailViaApi(normalizedEmail);
        emailSent = emailResult.sent === true;
      } catch (emailErr) {
        console.warn('sendPasswordResetEmailViaApi failed:', emailErr.message);
        try {
          resetLink = await generatePasswordResetLink(normalizedEmail);
        } catch (linkErr) {
          console.warn('generatePasswordResetLink failed:', linkErr.message);
        }
      }
    }

    res.json({
      uid,
      email: normalizedEmail,
      existingAuth,
      migrated,
      emailSent,
      resetLink,
    });
  } catch (error) {
    console.error('provisionUserLogin error:', error);
    res.status(500).json({error: error.message || 'Failed to provision user login'});
  }
});

// ---------------------------------------------------------------------------
// Server-authoritative payment and sensitive mutation APIs
// ---------------------------------------------------------------------------

const paymentBackend = require('./payment-backend')({
  admin,
  functions,
  applyCors,
  requireAuthenticatedPost,
  requireAdmin,
  getRazorpayCredentials,
});

// Intentionally replace the legacy export with the authoritative handler.
// The replacement still resolves legacy notes-based source metadata.
exports.razorpayWebhook = paymentBackend.razorpayWebhook;
exports.createBookingPaymentOrder = paymentBackend.createBookingPaymentOrder;
exports.createMembershipPaymentOrder = paymentBackend.createMembershipPaymentOrder;
exports.createMarketplacePaymentOrder = paymentBackend.createMarketplacePaymentOrder;
exports.spendWallet = paymentBackend.spendWallet;
exports.adjustWallet = paymentBackend.adjustWallet;
exports.createRazorpayRefund = paymentBackend.createRazorpayRefund;
exports.votePoll = paymentBackend.votePoll;
exports.votePollCallable = paymentBackend.votePollCallable;
exports.cleanupStalePendingBookings = paymentBackend.cleanupStalePendingBookings;
exports.banUser = paymentBackend.banUser;
exports.sendWhatsAppMessage = paymentBackend.sendWhatsAppMessage;
exports.integrationHealth = paymentBackend.integrationHealth;
exports.generateTournamentBracket = paymentBackend.generateTournamentBracket;

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Health check endpoint — GET /health */
exports.health = functions.https.onRequest((req, res) => {
  applyCors(req, res);
  res.json({
    status: 'ok',
    service: 'FCM Notification Service',
    timestamp: new Date().toISOString(),
  });
});
