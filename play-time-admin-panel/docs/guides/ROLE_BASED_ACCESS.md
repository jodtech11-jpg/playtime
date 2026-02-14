# Role-Based Access Control (RBAC) Implementation

## Overview

The Play Time Admin Panel implements role-based access control with two distinct user roles:

1. **Super Admin** - Full platform access
2. **Venue Manager** - Limited access to assigned venues

## Authentication

### Login Process
- **Email/Password Only** - Google sign-in has been removed
- Role selection (Venue/Super Admin) is for UI purposes only
- Actual role is determined from the user document in Firestore
- Role validation occurs during login to ensure user has correct permissions

### Login Flow
1. User selects role (Venue Manager or Super Admin)
2. User enters email and password
3. System authenticates with Firebase
4. System fetches user document from Firestore
5. System validates that user's role matches selected role
6. If valid, user is redirected to dashboard
7. If invalid, error message is displayed

## Menu Access by Role

### Super Admin Menu Items
Super Admins have access to **ALL** features:

1. **Dashboard** - Overview of all platform metrics
2. **Bookings** - Manage all bookings across all venues
3. **Memberships** - Manage all memberships
4. **Financials** - View all financial data
5. **Staff** - Manage all staff members
6. **Venues** - Create, edit, and manage all venues
7. **Moderation** - Content moderation (Super Admin only)
8. **Marketing & Offers** - Campaign management (Super Admin only)
9. **Tournaments** - Tournament management (Super Admin only)
10. **Marketplace** - Product and order management (Super Admin only)
11. **Support & Disputes** - Ticket management
12. **Notifications** - Push notification management
13. **CRM & Reports** - Analytics and reporting (Super Admin only)
14. **Settings** - Platform configuration (Super Admin only)

### Venue Manager Menu Items
Venue Managers have **LIMITED** access:

1. **Dashboard** - Overview of their assigned venues only
2. **Bookings** - Manage bookings for their assigned venues only
3. **Memberships** - Manage memberships for their assigned venues only
4. **Financials** - View financial data for their assigned venues only
5. **Staff** - Manage staff for their assigned venues only
6. **My Venues** - View and manage only their assigned venues
7. **Support & Disputes** - Create and view tickets
8. **Notifications** - View notifications

### Restricted Pages for Venue Managers
The following pages are **NOT accessible** to Venue Managers:
- ❌ **Moderation** - Content moderation (Super Admin only)
- ❌ **Marketing & Offers** - Campaign management (Super Admin only)
- ❌ **Tournaments** - Tournament management (Super Admin only)
- ❌ **Marketplace** - Product management (Super Admin only)
- ❌ **CRM & Reports** - Analytics (Super Admin only)
- ❌ **Settings** - Platform configuration (Super Admin only)

## Route Protection

Routes are protected using the `ProtectedRoute` component:

```typescript
// Super Admin only routes
<Route path="/moderation" element={<ProtectedRoute requireSuperAdmin><Moderation /></ProtectedRoute>} />
<Route path="/tournaments" element={<ProtectedRoute requireSuperAdmin><Tournaments /></ProtectedRoute>} />
<Route path="/marketplace" element={<ProtectedRoute requireSuperAdmin><Marketplace /></ProtectedRoute>} />
<Route path="/marketing" element={<ProtectedRoute requireSuperAdmin><Marketing /></ProtectedRoute>} />
<Route path="/crm" element={<ProtectedRoute requireSuperAdmin><CRM /></ProtectedRoute>} />
<Route path="/settings" element={<ProtectedRoute requireSuperAdmin><Settings /></ProtectedRoute>} />

// Accessible to both roles
<Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
<Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
```

## Data Filtering

### Venue Managers
- All data queries are automatically filtered by `managedVenues` array in user document
- Venue Managers can only see:
  - Bookings for their venues
  - Memberships for their venues
  - Staff for their venues
  - Financials for their venues
  - Their assigned venues only

### Super Admins
- No filtering applied
- Can view all data across all venues
- Full CRUD operations on all entities

## Firestore Security Rules

Security rules enforce role-based access:

```javascript
// Super Admin check
function isSuperAdmin() {
  return isAuthenticated() && 
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         getUserData().role == 'super_admin';
}

// Venue Manager check
function isVenueManager() {
  return isAuthenticated() && 
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         getUserData().role == 'venue_manager';
}

// Venue ownership check
function ownsVenue(venueId) {
  return isSuperAdmin() ||
         (isVenueManager() && venueId in getUserData().managedVenues);
}
```

## User Document Structure

```typescript
{
  id: string;                    // Firebase Auth UID
  email: string;                 // User email
  name: string;                  // Display name
  role: 'super_admin' | 'venue_manager';
  status: 'Active' | 'Pending' | 'Inactive';
  managedVenues?: string[];     // Array of venue IDs (for venue managers)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Creating Users

### Super Admin
Use the admin creation script:
```bash
node scripts/create-admin-user.js --email admin@example.com --password SecurePass123 --role super_admin
```

### Venue Manager
```bash
node scripts/create-admin-user.js --email manager@venue.com --password SecurePass123 --role venue_manager --venues venueId1,venueId2
```

## Sidebar Implementation

The sidebar dynamically shows menu items based on user role:

```typescript
const isSuperAdmin = user?.role === 'super_admin';
const isVenueManager = user?.role === 'venue_manager';

const baseNavItems = [/* Common items */];
const superAdminNavItems = [/* Admin-only items */];
const venueManagerNavItems = [/* Manager-only items */];

const navItems = isSuperAdmin 
  ? [...baseNavItems, ...superAdminNavItems]
  : isVenueManager
  ? [...baseNavItems, ...venueManagerNavItems]
  : baseNavItems;
```

## Security Notes

1. **Role Validation**: Always validate user role from Firestore, not just UI selection
2. **Route Protection**: All sensitive routes use `ProtectedRoute` with `requireSuperAdmin`
3. **Data Filtering**: Venue Managers automatically see filtered data based on `managedVenues`
4. **Firestore Rules**: Security rules enforce access at the database level
5. **No Client-Side Security**: Never rely solely on client-side checks; always verify server-side

## Testing Roles

### Test Super Admin
1. Login with super admin credentials
2. Verify all menu items are visible
3. Verify access to all pages
4. Verify can see all venues and data

### Test Venue Manager
1. Login with venue manager credentials
2. Verify only limited menu items are visible
3. Verify restricted pages show "Access Denied"
4. Verify can only see data for assigned venues

