# Trusted admin operations

Sensitive admin actions are requested by the browser but executed and audited by
authenticated HTTPS functions. The browser must never hold payment, WhatsApp,
service-account, or webhook secrets.

All POST endpoints use `Authorization: Bearer <Firebase ID token>`, reject unknown
fields, validate the caller's role and venue scope, and write an immutable audit
record. Configure `VITE_CLOUD_FUNCTIONS_BASE_URL` to the deployed functions origin.

Expected endpoints:

- `createRazorpayRefund`: starts a gateway refund using a payment document ID and paise amount. The order remains `Refund Pending`
  until a signed gateway webhook records `Processed` or `Failed`.
- `adjustWallet`: atomically updates balance and creates an `AdminAdjustment`
  wallet transaction with amount, reason, actor, and resulting balance.
- `banUser`: disables the account and applies venue-scoped moderation rules. Only a
  super admin may perform a global ban.
- `integrationHealth`: checks server-held Razorpay or WhatsApp configuration without
  returning secrets.
- `sendWhatsAppMessage`: sends one validated E.164 message using server-held provider credentials.
- `integrationHealth` (required backend addition): reports integration-specific
  configuration health without returning secrets.
- `generateTournamentBracket` (required backend addition): validates eligible teams and atomically creates the
  deterministic single-elimination matches.

The UI intentionally reports a missing endpoint instead of emulating these operations
with direct Firestore writes. Auto-settlement remains disabled until the backend marks
`autoSettlementConfigured` true.

FCM uses the same trust boundary: the browser may provide notification content and
recipient tokens, while the server verifies authorization and sends through the Admin
SDK. Do not use legacy FCM server keys in frontend environment variables.
