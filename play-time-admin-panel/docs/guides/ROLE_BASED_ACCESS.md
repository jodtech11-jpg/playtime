# Role-Based Access Control (RBAC)

## Overview

The Play Time Admin Panel uses a two-layer access model:

1. **Roles** determine who may sign in to the admin panel and how their data is scoped.
2. **Permissions** (managed in Users → Roles / Permissions) determine which admin pages and features a role can reach. Permissions are loaded at login and enforced by routes, the sidebar, and page guards.

### Roles

| Role | ID | Admin panel | Data scope |
|------|----|-------------|------------|
| Super Admin | `super_admin` | Full access, all permissions implicitly | Unscoped (all data) |
| Venue Manager (Vendor) | `venue_manager` | Scoped admin | `managedVenues` + `vendorId` |
| Custom roles | any `roles/{roleId}` doc | Scoped admin, permissions from role definition | `managedVenues` + `vendorId` |
| Player | `player` | Rejected at login (mobile app only) | N/A |

Custom roles are created in **Users → Roles** and can be assigned to users in the user form (super admin only). A custom role may sign in to the admin panel only while its `roles/{roleId}` document exists; deleting the role revokes access.

## Authentication

### Login Flow
1. User signs in with email/password, Google, or phone OTP.
2. System fetches the user document from Firestore (`users/{uid}`, with email fallback).
3. `status` must be `Active` (`Pending` and `Inactive` are rejected with a message).
4. `role` must be `super_admin`, `venue_manager`, or a custom role with an existing `roles/{roleId}` document. `player` accounts are rejected.
5. Effective permissions are resolved: role permissions (Firestore `roles/{roleId}` override, falling back to in-code system defaults) plus the user's `customPermissions` grants.
6. `AuthContext` exposes `isSuperAdmin`, `isVenueManager` (true for venue managers **and** custom roles), `permissions`, and `hasPermission(...)`.

### Vendor Self-Signup
Unauthenticated vendors can register from the login page. This creates `users/{uid}` with `role: 'venue_manager'`, `status: 'Pending'`. A super admin must approve the account (set `Active` and assign `managedVenues`) before login succeeds.

## Permission Catalog

Defined in `utils/rbac.ts` (single source of truth, shared by the Role/Permission Management pages and `AuthContext`). Firestore `permissions` docs can add to or override the defaults.

| Category | Permissions |
|----------|-------------|
| users | create, read, update, delete, manage |
| bookings | create, read, update, delete, manage |
| venues | create, read, update, delete, manage |
| tournaments | create, read, update, delete, manage |
| memberships | create, read, update, delete, manage |
| staff | create, read, update, delete, manage |
| financials | read, manage |
| marketing | create, read, update, delete |
| settings | read, update |

Editing a system role's permissions in **Users → Roles** persists a Firestore override that takes effect at the next login.

## Route Protection

Routes combine role guards and permission guards (`ProtectedRoute`):

| Route | Guard |
|-------|-------|
| `/financials` | `financials.read` (view); `financials.manage` for create invoice / process settlement |
| `/users`, `/users/:id` | `users.manage` |
| `/marketing` | `marketing.read` |
| `/settings` | `settings.read` |
| `/users/roles`, `/users/permissions` | Super admin only (RBAC administration) |
| `/activity-log`, `/moderation`, `/marketplace`, `/crm`, `/analytics`, `/frontend-cms`, `/user-manual` | Super admin only |
| `/venues`, `/venues/:id`, `/venues/courts` | Venue 2FA (`VenueProtectedRoute`) |
| Everything else (dashboard, bookings, memberships, staff, sports, tournaments, quick matches, leaderboards, polls, flash deals, support, notifications, payments, profile) | Any admin panel role |

Super admins implicitly hold every permission. Permission-gated routes and their sidebar entries appear for venue managers / custom roles when the permission is granted via Role Management or a per-user grant.

Note: even if a permission grants UI access, Firestore security rules remain the backstop — some data (e.g. platform-wide financial documents) is still writable only by super admins.

## Per-User Permission Grants (`customPermissions`)

Super admins can grant extra permissions to individual venue managers or custom-role users in the user form ("Extra Permissions"). These are stored in `users/{uid}.customPermissions` and merged with role permissions at login.

Security rules prevent self-escalation: users cannot change their own `role`, `status`, `managedVenues`, or `customPermissions`, and only super admins can hand out permission grants.

## Data Scoping

Two scoping keys apply to venue managers and custom roles:

- **`managedVenues`** — bookings, venues, staff, expenses, memberships, courts, posts.
- **`vendorId`** (creator's auth UID) — tournaments, quick matches, leaderboards, polls, flash deals.

Super admins see all data with no filters.

## Firestore Security Rules

```javascript
function isSuperAdmin() {
  return isAuthenticated() &&
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         getUserData().role == 'super_admin';
}

// Venue managers and custom admin roles (roles/{roleId} doc must exist).
function isVenueManager() {
  return isAuthenticated() &&
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         getUserData() != null &&
         (getUserData().role == 'venue_manager' ||
          ('role' in getUserData() &&
           getUserData().role is string &&
           !(getUserData().role in ['super_admin', 'player', 'venue_manager']) &&
           exists(/databases/$(database)/documents/roles/$(getUserData().role))));
}

function ownsVenue(venueId) {
  return isSuperAdmin() ||
         (isVenueManager() && venueId in getUserData().managedVenues);
}
```

## Cloud Functions

`requireAdmin` accepts `super_admin`, `venue_manager`, and custom roles backed by a `roles/{roleId}` document. Restrictions for non-super-admin callers:

- Cannot create or provision `super_admin` accounts.
- Can only create `venue_manager` accounts, limited to venues they manage.
- Cannot hand out `customPermissions` (super admin only).

## User Document Structure

```typescript
{
  id: string;                    // Firebase Auth UID
  email: string;
  name: string;
  role: 'super_admin' | 'venue_manager' | 'player' | string; // string = custom role ID
  status: 'Active' | 'Pending' | 'Inactive';
  managedVenues?: string[];      // Venue scoping (venue managers + custom roles)
  customPermissions?: string[];  // Extra permission grants beyond the role
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Creating Admin Users

Via UI: **Users → Add User** (super admin). Or via scripts:

```bash
node scripts/create-admin-user.js --email admin@example.com --password SecurePass123 --role super_admin
node scripts/create-admin-user.js --email manager@venue.com --password SecurePass123 --role venue_manager --venues venueId1,venueId2
```

Note: the scripts also set Firebase custom claims, but the app and security rules read the Firestore `users/{uid}.role` field, not claims.

## Security Notes

1. Role and permissions are always resolved from Firestore at login, never from client-side selection.
2. Route/sidebar checks are convenience only; Firestore rules and Cloud Functions enforce access server-side.
3. Users cannot self-escalate `role`, `status`, `managedVenues`, or `customPermissions`.
4. Deleting a custom role's Firestore document immediately revokes admin panel access for users holding it (at next auth check / data access).

## Testing

### Super Admin
1. All menu items visible, all pages accessible, unscoped data.

### Venue Manager
1. Scoped menu; Financials/Users/Marketing/Settings hidden unless granted.
2. Granting `financials.read` to a role surfaces Financials (view-only). Grant `financials.manage` for create invoice / process settlement.

### Custom Role
1. Create role in Users → Roles, assign permissions.
2. Assign to a user (with venues) in Users → Add/Edit User.
3. User signs in and sees pages allowed by the role's permissions, data scoped to assigned venues.
