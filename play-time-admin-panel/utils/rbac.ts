/**
 * Shared RBAC catalog: single source of truth for default permissions,
 * system role definitions, and effective-permission resolution.
 *
 * Used by:
 * - AuthContext (loads effective permissions at login)
 * - RoleManagement / PermissionManagement pages (catalog UI)
 * - UserFormModal (custom permission grants)
 */
import { Permission, RoleDefinition, User } from '../types';
import { rolesCollection } from '../services/firebase';

export const SYSTEM_ROLE_IDS = ['super_admin', 'venue_manager', 'player'] as const;

/** Default permissions - always available even without Firestore documents. */
export const DEFAULT_PERMISSIONS: Permission[] = [
  // User permissions
  { id: 'users.create', name: 'Create Users', description: 'Allow creating new user accounts', category: 'users', resource: 'users', action: 'create' },
  { id: 'users.read', name: 'View Users', description: 'Allow viewing user information', category: 'users', resource: 'users', action: 'read' },
  { id: 'users.update', name: 'Edit Users', description: 'Allow editing user information', category: 'users', resource: 'users', action: 'update' },
  { id: 'users.delete', name: 'Delete Users', description: 'Allow deleting user accounts', category: 'users', resource: 'users', action: 'delete' },
  { id: 'users.manage', name: 'Manage Users', description: 'Full user management access', category: 'users', resource: 'users', action: 'manage' },

  // Booking permissions
  { id: 'bookings.create', name: 'Create Bookings', description: 'Allow creating new bookings', category: 'bookings', resource: 'bookings', action: 'create' },
  { id: 'bookings.read', name: 'View Bookings', description: 'Allow viewing bookings', category: 'bookings', resource: 'bookings', action: 'read' },
  { id: 'bookings.update', name: 'Edit Bookings', description: 'Allow editing bookings', category: 'bookings', resource: 'bookings', action: 'update' },
  { id: 'bookings.delete', name: 'Delete Bookings', description: 'Allow deleting bookings', category: 'bookings', resource: 'bookings', action: 'delete' },
  { id: 'bookings.manage', name: 'Manage Bookings', description: 'Full booking management access', category: 'bookings', resource: 'bookings', action: 'manage' },

  // Venue permissions
  { id: 'venues.create', name: 'Create Venues', description: 'Allow creating new venues', category: 'venues', resource: 'venues', action: 'create' },
  { id: 'venues.read', name: 'View Venues', description: 'Allow viewing venues', category: 'venues', resource: 'venues', action: 'read' },
  { id: 'venues.update', name: 'Edit Venues', description: 'Allow editing venues', category: 'venues', resource: 'venues', action: 'update' },
  { id: 'venues.delete', name: 'Delete Venues', description: 'Allow deleting venues', category: 'venues', resource: 'venues', action: 'delete' },
  { id: 'venues.manage', name: 'Manage Venues', description: 'Full venue management access', category: 'venues', resource: 'venues', action: 'manage' },

  // Tournament permissions
  { id: 'tournaments.create', name: 'Create Tournaments', description: 'Allow creating new tournaments', category: 'tournaments', resource: 'tournaments', action: 'create' },
  { id: 'tournaments.read', name: 'View Tournaments', description: 'Allow viewing tournaments', category: 'tournaments', resource: 'tournaments', action: 'read' },
  { id: 'tournaments.update', name: 'Edit Tournaments', description: 'Allow editing tournaments', category: 'tournaments', resource: 'tournaments', action: 'update' },
  { id: 'tournaments.delete', name: 'Delete Tournaments', description: 'Allow deleting tournaments', category: 'tournaments', resource: 'tournaments', action: 'delete' },
  { id: 'tournaments.manage', name: 'Manage Tournaments', description: 'Full tournament management access', category: 'tournaments', resource: 'tournaments', action: 'manage' },

  // Membership permissions
  { id: 'memberships.create', name: 'Create Memberships', description: 'Allow creating new memberships', category: 'memberships', resource: 'memberships', action: 'create' },
  { id: 'memberships.read', name: 'View Memberships', description: 'Allow viewing memberships', category: 'memberships', resource: 'memberships', action: 'read' },
  { id: 'memberships.update', name: 'Edit Memberships', description: 'Allow editing memberships', category: 'memberships', resource: 'memberships', action: 'update' },
  { id: 'memberships.delete', name: 'Delete Memberships', description: 'Allow deleting memberships', category: 'memberships', resource: 'memberships', action: 'delete' },
  { id: 'memberships.manage', name: 'Manage Memberships', description: 'Full membership management access', category: 'memberships', resource: 'memberships', action: 'manage' },

  // Staff permissions
  { id: 'staff.create', name: 'Create Staff', description: 'Allow creating new staff members', category: 'staff', resource: 'staff', action: 'create' },
  { id: 'staff.read', name: 'View Staff', description: 'Allow viewing staff information', category: 'staff', resource: 'staff', action: 'read' },
  { id: 'staff.update', name: 'Edit Staff', description: 'Allow editing staff information', category: 'staff', resource: 'staff', action: 'update' },
  { id: 'staff.delete', name: 'Delete Staff', description: 'Allow deleting staff members', category: 'staff', resource: 'staff', action: 'delete' },
  { id: 'staff.manage', name: 'Manage Staff', description: 'Full staff management access', category: 'staff', resource: 'staff', action: 'manage' },

  // Financial permissions
  { id: 'financials.read', name: 'View Financials', description: 'Allow viewing financial reports', category: 'financials', resource: 'financials', action: 'read' },
  { id: 'financials.manage', name: 'Manage Financials', description: 'Full financial management access', category: 'financials', resource: 'financials', action: 'manage' },

  // Marketing permissions
  { id: 'marketing.create', name: 'Create Campaigns', description: 'Allow creating marketing campaigns', category: 'marketing', resource: 'marketing', action: 'create' },
  { id: 'marketing.read', name: 'View Campaigns', description: 'Allow viewing marketing campaigns', category: 'marketing', resource: 'marketing', action: 'read' },
  { id: 'marketing.update', name: 'Edit Campaigns', description: 'Allow editing marketing campaigns', category: 'marketing', resource: 'marketing', action: 'update' },
  { id: 'marketing.delete', name: 'Delete Campaigns', description: 'Allow deleting marketing campaigns', category: 'marketing', resource: 'marketing', action: 'delete' },

  // Settings permissions
  { id: 'settings.read', name: 'View Settings', description: 'Allow viewing platform settings', category: 'settings', resource: 'settings', action: 'read' },
  { id: 'settings.update', name: 'Edit Settings', description: 'Allow editing platform settings', category: 'settings', resource: 'settings', action: 'update' },
];

/** In-code system role definitions. Firestore docs with the same ID act as overrides. */
export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to all platform features and settings',
    permissions: DEFAULT_PERMISSIONS.map(p => p.id),
    isSystem: true,
  },
  {
    id: 'venue_manager',
    name: 'Vendor',
    description: 'Manage assigned venues, bookings, memberships, and staff',
    permissions: [
      'bookings.read', 'bookings.update', 'bookings.create',
      'memberships.read', 'memberships.update', 'memberships.create',
      'venues.read', 'venues.update',
      'tournaments.read', 'tournaments.create', 'tournaments.update',
      'staff.read', 'staff.create', 'staff.update', 'staff.delete',
      'financials.read',
      'users.read',
    ],
    isSystem: true,
  },
  {
    id: 'player',
    name: 'Player',
    description: 'Mobile app users who can book venues, join teams, and participate in matches',
    permissions: [
      'bookings.read', 'bookings.create',
      'venues.read',
      'users.read',
    ],
    isSystem: true,
  },
];

/**
 * Merge Firestore roles with the in-memory system roles.
 * Firestore docs for system role IDs act as overrides (e.g. edited permissions),
 * while keeping the system flag, name fallback and ordering intact.
 */
export const mergeWithSystemRoles = (customRoles: RoleDefinition[]): RoleDefinition[] => {
  const overrideMap = new Map<string, RoleDefinition>();
  customRoles.forEach(r => overrideMap.set(r.id, r));

  const allRoles = SYSTEM_ROLES.map(sysRole => {
    const override = overrideMap.get(sysRole.id);
    if (!override) return sysRole;
    return {
      ...sysRole,
      ...override,
      name: override.name || sysRole.name,
      permissions: override.permissions ?? sysRole.permissions,
      isSystem: true,
    };
  });

  customRoles.forEach(customRole => {
    if (!SYSTEM_ROLES.find(sr => sr.id === customRole.id)) {
      allRoles.push(customRole);
    }
  });

  return allRoles;
};

/** Merge Firestore permission docs with the in-code defaults (Firestore overrides by ID). */
export const mergeWithDefaultPermissions = (customPermissions: Permission[]): Permission[] => {
  const permissionMap = new Map<string, Permission>();
  DEFAULT_PERMISSIONS.forEach(perm => permissionMap.set(perm.id, perm));
  customPermissions.forEach(perm => permissionMap.set(perm.id, perm));
  return Array.from(permissionMap.values());
};

const systemRoleById = (roleId: string): RoleDefinition | undefined =>
  SYSTEM_ROLES.find(r => r.id === roleId);

/**
 * Resolve the permission IDs granted by a role.
 * Firestore `roles/{roleId}` overrides the in-code system defaults; falls back
 * to system defaults (or an empty set for unknown roles) when Firestore is
 * unavailable.
 */
export const resolveRolePermissions = async (roleId: string): Promise<string[]> => {
  const fallback = systemRoleById(roleId)?.permissions ?? [];
  try {
    const roleDoc = (await rolesCollection.get(roleId)) as RoleDefinition | null;
    if (roleDoc && Array.isArray(roleDoc.permissions)) {
      return roleDoc.permissions;
    }
  } catch (err) {
    console.warn(`Failed to load role document for "${roleId}", using defaults:`, err);
  }
  return fallback;
};

/**
 * Compute the effective permission set for a user:
 * role permissions (Firestore override or system default) plus any
 * per-user `customPermissions` grants. Super admins get every permission.
 */
export const resolveEffectivePermissions = async (user: User): Promise<string[]> => {
  if (user.role === 'super_admin') {
    return DEFAULT_PERMISSIONS.map(p => p.id);
  }
  const rolePermissions = await resolveRolePermissions(String(user.role));
  const custom = Array.isArray(user.customPermissions) ? user.customPermissions : [];
  return Array.from(new Set([...rolePermissions, ...custom]));
};

/**
 * Whether a role may sign in to the admin panel.
 * System admin roles always may; `player` never may; any other role is a
 * custom role and is allowed only if a `roles/{roleId}` document exists.
 */
/** Sync label for lists/tables (system name or title-cased id). Prefer resolveRoleDisplayName for the signed-in user. */
export const formatRoleLabel = (roleId: string | undefined | null): string => {
  if (!roleId) return 'User';
  const system = systemRoleById(roleId);
  if (system) return system.name;
  return roleId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Human-readable label for a role ID (system default, Firestore name, or title-cased id). */
export const resolveRoleDisplayName = async (roleId: string | undefined | null): Promise<string> => {
  if (!roleId) return 'User';
  const system = systemRoleById(roleId);
  if (system) return system.name;
  try {
    const roleDoc = (await rolesCollection.get(roleId)) as RoleDefinition | null;
    if (roleDoc?.name) return roleDoc.name;
  } catch (err) {
    console.warn(`Failed to load role name for "${roleId}":`, err);
  }
  return formatRoleLabel(roleId);
};

export const isAdminPanelRole = async (roleId: string | undefined | null): Promise<boolean> => {
  if (!roleId || roleId === 'player') return false;
  if (roleId === 'super_admin' || roleId === 'venue_manager') return true;
  try {
    const roleDoc = await rolesCollection.get(roleId);
    return !!roleDoc;
  } catch (err) {
    console.warn(`Failed to verify custom role "${roleId}":`, err);
    return false;
  }
};
