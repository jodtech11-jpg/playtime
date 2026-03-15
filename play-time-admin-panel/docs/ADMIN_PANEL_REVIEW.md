# Admin Panel Review – Missing Checks & Gaps

**Reviewed**: February 2026

This document summarizes missing checks, inconsistencies, and improvement opportunities in the Play Time Admin Panel.

---

## Critical / Bugs

### 1. **TicketDetailModal – Wrong role filter (bug)**

**File**: `components/modals/TicketDetailModal.tsx`

The “Assign to” dropdown filters users by `u.role === 'Super Admin' || u.role === 'Admin'`. The app uses **snake_case** roles in `types.ts` and everywhere else: `super_admin`, `venue_manager`, `player`. There is no `'Admin'` role.

**Effect**: The dropdown will always be empty (no users match).

**Fix**: Use the same role values as the rest of the app, e.g. filter by `super_admin` (and optionally `venue_manager` if they should be assignable).

---

### 2. **AuthContext – Missing Firestore user doc**

**File**: `contexts/AuthContext.tsx`

When Firebase Auth has a user but the corresponding **Firestore user document is missing**:

- `setError('User profile not found. Please contact administrator.')` is set.
- `user` stays `null`, so `isAuthenticated` is `false` and unauthenticated routes (Landing/Login) are shown.
- The user is **not** signed out from Firebase, so `firebaseUser` remains set.
- **Auth `error` is not shown** on the Login or Landing page, so the user never sees “User profile not found.”

**Recommendations**:

- When the Firestore user doc is missing for the signed-in Firebase user:
  - Call `signOut()` (or equivalent) so the session is cleared and the user is not stuck in a half-in state.
- Show auth errors in the shell when on Login/Landing (e.g. read `error` from `useAuth()` and render a banner or inline message).

---

## Security & Access

### 3. **VenueProtectedRoute not used**

**Files**: `App.tsx`, `components/layout/VenueProtectedRoute.tsx`, `contexts/VenueTwoStepAuthContext.tsx`

- **VenueProtectedRoute** exists and enforces:
  - Auth + optional Super Admin / Venue Manager checks
  - **2FA for venue-related routes** (e.g. `/venues`, `/venues/:id`, `/venues/courts`) via `VenueTwoStepAuthModal`.
- In **App.tsx**, venue routes use **ProtectedRoute** only, not **VenueProtectedRoute**:
  - `/venues`, `/venues/:venueId`, `/venues/courts` are wrapped in `<ProtectedRoute>`.

**Effect**: Venue 2FA is never enforced; any authenticated user with access to those routes can open them without re-verification.

**Options**:

- **Enforce 2FA**: Use `VenueProtectedRoute` (and ensure `VenueTwoStepAuthProvider` wraps the app where needed) for `/venues`, `/venues/:venueId`, and `/venues/courts`.
- **Or**: If 2FA for venues is not required, document that decision and consider removing or repurposing `VenueProtectedRoute` to avoid confusion.

---

### 4. **Role consistency**

- **Types**: `types.ts` defines `Role` enum: `player`, `venue_manager`, `super_admin`.
- **Sidebar/Header**: Use `user?.role === 'super_admin'` and `user?.role === 'venue_manager'` (correct).
- **TicketDetailModal**: Uses `'Super Admin'` and `'Admin'` (incorrect) – see Critical #1.

**Recommendation**: Use only the enum values (`super_admin`, `venue_manager`, `player`) everywhere. Fix TicketDetailModal and add a quick grep for `'Admin'` / `'Super Admin'` in the repo to catch any other display/role checks.

---

## Configuration & Environment

### 5. **Firebase config validation only in development**

**File**: `config/firebase.config.ts`

- `validateFirebaseConfig()` is called only when `import.meta.env.DEV` is true.
- In production, missing or invalid env vars (e.g. `VITE_FIREBASE_*`) are not validated at startup, which can lead to obscure runtime errors.

**Recommendation**: In production build, either:

- Call a validation that throws or logs loudly if required Firebase keys are missing, or
- Have a minimal runtime check on first Firebase use and show a clear error to the user or log to monitoring.

---

### 6. **`.env.example`**

- Docs (e.g. SETUP_INSTRUCTIONS, ENV_SETUP, FIREBASE_DEPLOYMENT) refer to copying from `.env.example`.
- The repo has `.env` and `.env.local` (gitignored); an `.env.example` (committed) was not found.

**Recommendation**: Add a committed `.env.example` listing all `VITE_*` (and other) keys without real values, so new contributors and deployments know what to set.

---

## UX & Edge Cases

### 7. **Login – No surface for auth context error**

- If the user is not authenticated and `AuthContext` has an `error` (e.g. after “User profile not found”), the Login page does not read or display `useAuth().error`.
- Users may not understand why they cannot access the app.

**Recommendation**: On Login (and optionally Landing), if `error` from `useAuth()` is set, show it (banner or inline) and optionally clear it when the user successfully signs in or navigates away.

---

### 8. **Loading state in ProtectedRoute**

**File**: `components/layout/ProtectedRoute.tsx`

- When `loading === 'loading'` a spinner is shown.
- When `loading === 'error'` (from AuthContext), the code falls through; `isAuthenticated` is false, so the user is redirected to `/login`. That behavior is acceptable, but the **error reason** is not shown.

**Recommendation**: Optionally, when `loading === 'error'`, show a short message (or use the auth context error) before redirecting, so support/debugging is easier.

---

## What’s in good shape

- **Venue not found**: `VenueDetail` shows a clear “Venue not found” and “Back to Venues” when `venueId` is invalid or missing.
- **User not found**: `UserDetail` shows “User not found” and “Back to Users” when the user does not exist.
- **CmsPageView**: Handles missing/unpublished page with “Page not found” and back navigation.
- **ErrorBoundary**: Catches render errors and shows a recovery UI with details and “Try again” / “Reload”.
- **Role-based sidebar**: Menu items are correctly gated by `super_admin` and `venue_manager`.
- **Route protection**: Super-admin-only routes use `requireSuperAdmin`; auth redirect to `/login` when not authenticated is in place.

---

## Summary checklist

| Item | Severity | Status |
|------|----------|--------|
| TicketDetailModal role filter (`Super Admin` / `Admin` → `super_admin`) | Critical (bug) | Done |
| Auth: sign out when Firestore user doc missing + show auth error on Login | High | Done |
| Use VenueProtectedRoute for venue routes (or document why not) | Medium | Done (2FA enforced) |
| Firebase config validation in production | Medium | Done |
| Add `.env.example` | Low | Done |
| Show auth error on Login/Landing when set | Low | Done |

---

## Next steps (implemented)

1. **Done**: Fixed `TicketDetailModal` to use `super_admin` and `venue_manager` for the assignee dropdown.
2. **Done**: Venue routes now use `VenueProtectedRoute` with `VenueTwoStepAuthProvider`; 2FA is required for venue management.
3. **Done**: AuthContext signs out when Firestore user doc is missing; auth error is shown on Login and Landing.
4. **Done**: Added `.env.example`; production build now validates Firebase config and throws if required vars are missing.
