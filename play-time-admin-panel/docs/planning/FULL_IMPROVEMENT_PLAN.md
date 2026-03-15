# Full Improvement Plan – Mobile App, Admin Panel & Firebase

This document is the single implementation plan for all recommended improvements, including **Firebase (Firestore indexes, Firestore rules, Storage rules)**. Work in the order of phases to respect dependencies.

---

## Phase 0: Firebase – Indexes, Rules & Storage (Do First)

*Deploy these so admin and mobile features that depend on them can be built.*

### 0.1 Firestore indexes

**File:** `firestore.indexes.json`

| # | Purpose | Collection | Fields (order) | Action |
|---|--------|------------|----------------|--------|
| 1 | Admin: bookings list by date range + status + venue | `bookings` | `venueId` ASC, `status` ASC, `startTime` DESC | Add if not present |
| 2 | Admin: bookings export / filter by date | `bookings` | `startTime` DESC, `status` ASC | Add if not present |
| 3 | Admin: activity/audit log list | `activityLog` | `createdAt` DESC | Add (new collection) |
| 4 | Admin: activity log by user | `activityLog` | `userId` ASC, `createdAt` DESC | Add |
| 5 | Mobile: user bookings (existing) | `bookings` | `userId` ASC, `startTime` DESC | Verify exists |

**Steps:**
- Open `firestore.indexes.json` and add any missing index objects to the `indexes` array.
- Run `npx firebase deploy --only firestore:indexes` from the admin panel directory.
- If Firestore suggests a new index at runtime (link in error), add that definition and redeploy.

### 0.2 Firestore rules

**File:** `firestore.rules`

| # | Change | Details |
|---|--------|--------|
| 1 | **activityLog collection** | New collection for audit trail. Rules: `allow read: if isAuthenticated() && isSuperAdmin();` `allow create: if isAuthenticated();` (server/client writes actor uid, action, target, timestamp). No update/delete. |
| 2 | **Bookings list by venue/status** | No rule change needed; keep current read/write rules. Indexes only. |
| 3 | **Optional: bookings export** | If you add an Admin SDK backend for export, rules stay client-side as-is; export runs with admin credentials. |

**Suggested rule block to add (after existing collections, before default deny):**

```javascript
// Activity / audit log (admin only read; authenticated create)
match /activityLog/{logId} {
  allow read: if isAuthenticated() && isSuperAdmin();
  allow create: if isAuthenticated();
  allow update, delete: if false;
}
```

**Steps:**
- Insert the `activityLog` block in `firestore.rules`.
- Run `npx firebase deploy --only firestore:rules`.

### 0.3 Storage rules

**File:** `storage.rules`

| # | Change | Details |
|---|--------|--------|
| 1 | **Booking receipts / proof (optional)** | If mobile app will upload booking receipts or proof of payment: add path e.g. `bookings/{bookingId}/{allPaths=**}` with read: owner or admin; write: authenticated and `request.resource.contentType` in allowed list (e.g. image/jpeg, image/png, application/pdf). |
| 2 | **Mobile app uploads namespace** | If you want a dedicated path for “user uploads” (e.g. support attachments): e.g. `user-uploads/{userId}/{allPaths=**}` with read/write for that userId (and optional admin read). |
| 3 | **Tighten writes** | Review `venues/{venueId}/{allPaths=**}` and `posts`, `teams` – if you want only venue owners to write venue images, add `ownsVenue(venueId)` (requires passing venueId; Storage rules can use custom claims or Firestore get for that). Document decision if left as-is. |

**Steps:**
- Add only the paths you will use (e.g. `activityLog` does not need Storage).
- Run `npx firebase deploy --only storage`.

### 0.4 Deploy Firebase

```bash
cd play-time-admin-panel
npx firebase deploy --only firestore
npx firebase deploy --only storage
```

Use `--only firestore:indexes` and `--only firestore:rules` if you prefer to deploy indexes and rules separately.

---

## Phase 1: Mobile App – Quick Wins & Code Quality

### 1.1 Lint and logging

- [ ] Replace every `print(` with `debugPrint(` in `play_time_mobile/lib`.
- [ ] Fix `deprecated_member_use`: replace `withOpacity` with `withValues(alpha: ...)` (or appropriate `withValues` overload) across the app.
- [ ] Fix `use_build_context_synchronously`: capture `context` or `ScaffoldMessenger` before `async` and check `mounted` after awaits; use the captured messenger for SnackBars.
- [ ] Run `flutter analyze` and resolve remaining info/warning where feasible.

### 1.2 Offline and network

- [ ] Add package `connectivity_plus`.
- [ ] Create a small `NetworkBanner` or overlay: when connectivity is none, show “No internet” and optional “Retry” (e.g. trigger refresh of current screen).
- [ ] On critical actions (e.g. create booking, payment): on failure, show SnackBar with “Retry” that re-runs the action.
- [ ] Optional: cache venues list (e.g. in-memory or simple persistent cache) and show cached data when offline with a “Offline – data may be outdated” hint.

### 1.3 Pull-to-refresh

- [ ] Home: wrap the main list in `RefreshIndicator`, on refresh call VenueProvider refresh (or reload venues).
- [ ] My Bookings: wrap list in `RefreshIndicator`, on refresh call BookingProvider refresh.
- [ ] Profile: add RefreshIndicator where stats and booking list are shown; refresh profile + bookings.

### 1.4 Error and empty states

- [ ] Define a small set of strings/messages: “Something went wrong”, “No internet”, “No bookings”, “No courts”, “Retry”, “Contact support”.
- [ ] Use them consistently in FirestoreService catch blocks and in empty-state widgets.
- [ ] Ensure every main screen has an explicit empty state (icon + message + optional CTA).

### 1.5 Form validation

- [ ] Login/signup: validate phone/email format; show inline errors.
- [ ] Venue detail booking: ensure date/court/slot selected before “Book”; show inline error if missing.
- [ ] After successful booking: show confirmation bottom sheet or screen with “View booking” and optional “Add to calendar”.

---

## Phase 2: Mobile App – Features

### 2.1 Booking pass screen

- [ ] Add route e.g. `/booking-pass?id= bookingId`.
- [ ] New screen: load booking by id (Firestore or from provider); show venue name, date, time, court, status, and a QR code or short code (e.g. booking id) for staff validation.
- [ ] “View detail pass” from profile/booking card can navigate to `/booking-pass?id=...` in addition to or instead of venue detail (or offer both: “View pass” → pass screen, “View venue” → venue detail).

### 2.2 Deep linking

- [ ] Add `go_router` deep link config (e.g. `venue-detail` with path `/venue/:id` and `booking-pass` with path `/booking/:id`).
- [ ] Configure Android intent filters and iOS URL schemes (and associated domains if using universal links).
- [ ] Test: open app via link to venue and to booking pass.

### 2.3 Analytics and crash reporting

- [ ] Add Firebase Analytics: log screen views, “booking_started”, “booking_completed”, “payment_success” / “payment_failed”.
- [ ] Add Firebase Crashlytics: enable in Flutter and verify stack traces in Firebase console.

### 2.4 Loading and skeletons

- [ ] Add a simple shimmer/skeleton widget (or package).
- [ ] Home: show skeleton cards while venues load.
- [ ] Venue detail: show skeleton for courts and time slots.

### 2.5 Accessibility

- [ ] Add `Semantics` labels for primary actions: “Book court”, “View pass”, “Cancel booking”, “Quick book”, “My bookings”.
- [ ] Check contrast for primary buttons and status chips; fix if needed.

### 2.6 Localisation (optional)

- [ ] Move all user-facing strings to a single place (e.g. `AppLocalizations` or existing language provider).
- [ ] Add at least one more locale (e.g. Hindi or Tamil) and wire to language settings.

### 2.7 Tests (optional)

- [ ] Unit tests for BookingProvider (create, cancel, state).
- [ ] Widget tests for booking card and “View pass” / “View venue” buttons.
- [ ] Integration test: open app → login → open a venue → select slot → create booking (mock or test backend).

---

## Phase 3: Admin Panel – Quick Wins & Robustness

### 3.1 Review and role consistency

- [ ] Re-verify every item in `docs/ADMIN_PANEL_REVIEW.md` is done.
- [ ] Grep for `'Admin'`, `'Super Admin'` (display-only labels are fine); ensure all **role checks** use `super_admin` or `venue_manager` (e.g. TicketDetailModal, any dropdown or permission check).
- [ ] Ensure VenueProtectedRoute (2FA) is used for venue routes and document in README.

### 3.2 Auth and error UX

- [ ] Login/Landing: if `useAuth().error` is set, show a banner or inline message and optionally a “Dismiss” that clears it.
- [ ] ProtectedRoute: when `loading === 'error'`, optionally show a short message (or auth error) before redirect to login.
- [ ] Ensure AuthContext signs out when Firestore user doc is missing and sets a clear error message.

### 3.3 Activity / audit log

- [ ] Create Firestore collection `activityLog` with fields: `userId`, `userEmail` (optional), `action` (string), `targetType` (e.g. `booking`, `user`, `venue`), `targetId`, `details` (map or string), `createdAt` (timestamp).
- [ ] On sensitive actions (e.g. cancel booking, change user role, delete venue, create/delete court), write a document to `activityLog` (from admin client with current user uid).
- [ ] Add an “Activity log” or “Audit log” page (super_admin only): list recent logs with filters (user, action type, date); use index `createdAt` DESC (and optional `userId` ASC, `createdAt` DESC).
- [ ] Firestore rules: already added in Phase 0.2.

### 3.4 Mobile responsiveness

- [ ] Sidebar: collapse to icons (or drawer) on small/medium width; use a breakpoint (e.g. 1024px).
- [ ] Dashboard, Bookings, Venues, Court management: ensure tables/cards stack or scroll horizontally on small screens; forms stay usable.
- [ ] Test on tablet and small laptop viewports.

### 3.5 Search and filters (Bookings, Users, Venues)

- [ ] Bookings: add filters for venue (dropdown), date range (from/to), status (Pending, Confirmed, etc.); persist in URL query params so links are shareable.
- [ ] Users: add search by email/name and filter by role; persist in URL.
- [ ] Venues: add search by name and filter by status; persist in URL.
- [ ] Use Firestore queries with `where` and `orderBy` matching the indexes from Phase 0.1; paginate or limit (e.g. 50 per page) to avoid large reads.

### 3.6 Bulk actions

- [ ] Bookings list: checkboxes to select multiple; “Bulk confirm” / “Bulk cancel” (with confirmation dialog). Only for super_admin or venue manager for their venues.
- [ ] Users list: optional “Export selected” (CSV) or bulk role change (with confirmation).

### 3.7 Dashboard metrics

- [ ] Dashboard: show real data – e.g. bookings count today/this week, revenue (from bookings or payments), top venues by bookings, recent signups (from Firestore).
- [ ] Use existing indexes where possible; add new indexes only if new query patterns are needed (document in Phase 0.1).

### 3.8 Export

- [ ] Bookings: “Export CSV” button (date range + current filters); fetch data (paginated if needed) and generate CSV client-side or via a small Cloud Function.
- [ ] Users: “Export CSV” with current filters (role, search).
- [ ] Document in README where exports are stored (download only vs. temporary Storage path).

### 3.9 Notifications for venue managers

- [ ] When a booking is created or cancelled for a venue, create a document in `notifications` for the venue manager(s) (or FCM topic per venue).
- [ ] Use existing FCM token registration; send via Admin SDK or Cloud Function.
- [ ] Optional: in-app notification centre (list notifications, mark as read).

### 3.10 Error boundaries and toasts

- [ ] Ensure ErrorBoundary wraps the main app and each major route section.
- [ ] Ensure all Firebase/API errors show a toast with message and optional “Retry” where applicable.

### 3.11 Performance

- [ ] Bookings/Users lists: use virtualisation (e.g. `react-window`) or pagination with `limit()` and “Load more”.
- [ ] Heavy pages (Analytics, Financials): show loading state and lazy-load data.

---

## Phase 4: Admin Panel – Nice to Have

- [ ] E2E tests (Playwright/Cypress): login → Bookings → filter → open one; create court; create user.
- [ ] Dark/light theme: ensure all pages and modals respect ThemeContext.
- [ ] Keyboard shortcuts: e.g. Ctrl+S to save in modals, Ctrl+N for new booking (document in README).

---

## Phase 5: Cross-Cutting & CI/CD

- [ ] **Security:** Once activity log is in place, review Firestore rules once more; ensure no collection is over-permissive. Keep bookings read as-is for authenticated users (needed for conflict check).
- [ ] **Env:** Admin has `.env.example` and production Firebase config validation; keep and document. Mobile: ensure wrong env fails fast in dev.
- [x] **CI/CD:** Add pipeline (e.g. GitHub Actions):
  - On PR/push: run `flutter analyze` and `flutter test` for mobile; run `npm run build` for admin (`.github/workflows/ci.yml`).
  - On push to main: deploy admin to Firebase Hosting (`.github/workflows/deploy.yml`; requires `FIREBASE_TOKEN` and `VITE_FIREBASE_*` secrets). Mobile build/artifacts can be added later.

---

## Firebase Checklist Summary

| Item | File | Action |
|------|------|--------|
| Bookings by venue + status + startTime | firestore.indexes.json | Add if missing |
| Bookings by startTime + status | firestore.indexes.json | Add if missing |
| activityLog by createdAt | firestore.indexes.json | Add |
| activityLog by userId + createdAt | firestore.indexes.json | Add |
| activityLog rules | firestore.rules | Add block (read: super_admin; create: authenticated) |
| Booking receipts path (optional) | storage.rules | Add if feature needed |
| Deploy | CLI | `firebase deploy --only firestore` and `--only storage` |

---

## Suggested Order of Implementation

1. **Phase 0** – Firebase indexes, Firestore rules (activityLog), Storage rules; deploy.
2. **Phase 1** – Mobile quick wins (lint, offline banner, pull-to-refresh, error messages, form validation).
3. **Phase 3.1–3.3** – Admin review, auth/error UX, activity log implementation.
4. **Phase 2.1, 2.2** – Mobile booking pass screen and deep linking.
5. **Phase 3.4–3.8** – Admin responsiveness, filters, bulk actions, dashboard, export.
6. **Phase 2.3–2.5** – Mobile analytics, skeletons, accessibility.
7. **Phase 3.9–3.11** – Admin notifications, error handling, performance.
8. **Phase 4 & 5** – E2E, theme, shortcuts, CI/CD.

Use this file as a living checklist; tick items as they are done and add new rows for any extra indexes or rules you introduce.
