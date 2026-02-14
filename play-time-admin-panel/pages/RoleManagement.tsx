import React, { useState, useEffect, useMemo } from 'react';
import { rolesCollection, permissionsCollection } from '../services/firebase';
import { RoleDefinition, Permission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';

// Default permissions - these are always available
const DEFAULT_PERMISSIONS: Permission[] = [
  // User permissions
  { id: 'users.create', name: 'Create Users', category: 'users', resource: 'users', action: 'create' },
  { id: 'users.read', name: 'View Users', category: 'users', resource: 'users', action: 'read' },
  { id: 'users.update', name: 'Edit Users', category: 'users', resource: 'users', action: 'update' },
  { id: 'users.delete', name: 'Delete Users', category: 'users', resource: 'users', action: 'delete' },
  { id: 'users.manage', name: 'Manage Users', category: 'users', resource: 'users', action: 'manage' },
  
  // Booking permissions
  { id: 'bookings.create', name: 'Create Bookings', category: 'bookings', resource: 'bookings', action: 'create' },
  { id: 'bookings.read', name: 'View Bookings', category: 'bookings', resource: 'bookings', action: 'read' },
  { id: 'bookings.update', name: 'Edit Bookings', category: 'bookings', resource: 'bookings', action: 'update' },
  { id: 'bookings.delete', name: 'Delete Bookings', category: 'bookings', resource: 'bookings', action: 'delete' },
  { id: 'bookings.manage', name: 'Manage Bookings', category: 'bookings', resource: 'bookings', action: 'manage' },
  
  // Venue permissions
  { id: 'venues.create', name: 'Create Venues', category: 'venues', resource: 'venues', action: 'create' },
  { id: 'venues.read', name: 'View Venues', category: 'venues', resource: 'venues', action: 'read' },
  { id: 'venues.update', name: 'Edit Venues', category: 'venues', resource: 'venues', action: 'update' },
  { id: 'venues.delete', name: 'Delete Venues', category: 'venues', resource: 'venues', action: 'delete' },
  { id: 'venues.manage', name: 'Manage Venues', category: 'venues', resource: 'venues', action: 'manage' },
  
  // Staff permissions
  { id: 'staff.create', name: 'Create Staff', category: 'staff', resource: 'staff', action: 'create' },
  { id: 'staff.read', name: 'View Staff', category: 'staff', resource: 'staff', action: 'read' },
  { id: 'staff.update', name: 'Edit Staff', category: 'staff', resource: 'staff', action: 'update' },
  { id: 'staff.delete', name: 'Delete Staff', category: 'staff', resource: 'staff', action: 'delete' },
  { id: 'staff.manage', name: 'Manage Staff', category: 'staff', resource: 'staff', action: 'manage' },
  
  // Financial permissions
  { id: 'financials.read', name: 'View Financials', category: 'financials', resource: 'financials', action: 'read' },
  { id: 'financials.manage', name: 'Manage Financials', category: 'financials', resource: 'financials', action: 'manage' },
  
  // Marketing permissions
  { id: 'marketing.create', name: 'Create Campaigns', category: 'marketing', resource: 'marketing', action: 'create' },
  { id: 'marketing.read', name: 'View Campaigns', category: 'marketing', resource: 'marketing', action: 'read' },
  { id: 'marketing.update', name: 'Edit Campaigns', category: 'marketing', resource: 'marketing', action: 'update' },
  { id: 'marketing.delete', name: 'Delete Campaigns', category: 'marketing', resource: 'marketing', action: 'delete' },
  
  // Settings permissions
  { id: 'settings.read', name: 'View Settings', category: 'settings', resource: 'settings', action: 'read' },
  { id: 'settings.update', name: 'Edit Settings', category: 'settings', resource: 'settings', action: 'update' },
];

const RoleManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>(DEFAULT_PERMISSIONS);
  const [isViewMode, setIsViewMode] = useState(false);

  // Default system roles
  const systemRoles: RoleDefinition[] = useMemo(() => [
    {
      id: 'super_admin',
      name: 'Super Admin',
      description: 'Full access to all platform features and settings',
      permissions: DEFAULT_PERMISSIONS.map(p => p.id),
      isSystem: true
    },
    {
      id: 'venue_manager',
      name: 'Venue Manager',
      description: 'Manage assigned venues, bookings, memberships, and staff',
      permissions: [
        'bookings.read', 'bookings.update', 'bookings.create',
        'memberships.read', 'memberships.update', 'memberships.create',
        'venues.read', 'venues.update',
        'staff.read', 'staff.create', 'staff.update', 'staff.delete',
        'financials.read',
        'users.read'
      ],
      isSystem: true
    },
    {
      id: 'player',
      name: 'Player',
      description: 'Mobile app users who can book venues, join teams, and participate in matches',
      permissions: [
        'bookings.read', 'bookings.create',
        'venues.read',
        'users.read'
      ],
      isSystem: true
    }
  ], []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch custom roles from Firestore
        const customRoles = await rolesCollection.getAll() as RoleDefinition[];
        
        // Combine system roles with custom roles
        // System roles should always come first
        const allRoles = [...systemRoles];
        
        // Add custom roles that aren't system roles
        customRoles.forEach(customRole => {
          if (!systemRoles.find(sr => sr.id === customRole.id)) {
            allRoles.push(customRole);
          }
        });
        
        setRoles(allRoles);
        
        // Fetch permissions from Firestore
        try {
          const customPermissions = await permissionsCollection.getAll() as Permission[];
          const permissionMap = new Map<string, Permission>();
          
          // Add default permissions first
          DEFAULT_PERMISSIONS.forEach(perm => {
            permissionMap.set(perm.id, perm);
          });
          
          // Add/override with custom permissions
          customPermissions.forEach(perm => {
            permissionMap.set(perm.id, perm);
          });
          
          setAvailablePermissions(Array.from(permissionMap.values()));
        } catch (permErr) {
          console.error('Error fetching permissions:', permErr);
          // Use default permissions if fetch fails
          setAvailablePermissions(DEFAULT_PERMISSIONS);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching roles:', err);
        setError(err.message || 'Failed to fetch roles');
        // Fallback to system roles only
        setRoles(systemRoles);
        setAvailablePermissions(DEFAULT_PERMISSIONS);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query)
    );
  }, [roles, searchQuery]);

  const handleCreateRole = () => {
    setSelectedRole(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setNewEntryHandler(handleCreateRole);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const handleEditRole = (role: RoleDefinition) => {
    setSelectedRole(role);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const handleViewRole = (role: RoleDefinition) => {
    setSelectedRole(role);
    setIsViewMode(true);
    setIsModalOpen(true);
  };

  const handleSaveRole = async (roleData: Partial<RoleDefinition>) => {
    try {
      setProcessing('saving');
      
      if (selectedRole) {
        if (selectedRole.isSystem) {
          alert('System roles cannot be modified');
          setProcessing(null);
          return;
        }
        await rolesCollection.update(selectedRole.id, {
          ...roleData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Generate a valid role ID from the name
        const roleId = roleData.id || roleData.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || `role_${Date.now()}`;
        await rolesCollection.create(roleId, {
          id: roleId,
          ...roleData,
          isSystem: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setSelectedRole(null);
      setProcessing(null);
      
      // Refresh roles from Firestore
      const customRoles = await rolesCollection.getAll() as RoleDefinition[];
      const allRoles = [...systemRoles];
      customRoles.forEach(customRole => {
        if (!systemRoles.find(sr => sr.id === customRole.id)) {
          allRoles.push(customRole);
        }
      });
      setRoles(allRoles);
    } catch (err: any) {
      console.error('Error saving role:', err);
      setProcessing(null);
      alert(`Failed to save role: ${err.message}`);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.isSystem) {
      alert('System roles cannot be deleted');
      return;
    }

    if (!confirm('Are you sure you want to delete this role? Users with this role will need to be reassigned.')) {
      return;
    }

    try {
      setProcessing(roleId);
      await rolesCollection.delete(roleId);
      setProcessing(null);
      
      // Refresh roles from Firestore
      const customRoles = await rolesCollection.getAll() as RoleDefinition[];
      const allRoles = [...systemRoles];
      customRoles.forEach(customRole => {
        if (!systemRoles.find(sr => sr.id === customRole.id)) {
          allRoles.push(customRole);
        }
      });
      setRoles(allRoles);
    } catch (err: any) {
      console.error('Error deleting role:', err);
      setProcessing(null);
      alert(`Failed to delete role: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading roles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Error loading roles</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Role Management</h1>
          <p className="text-sm text-gray-500 mt-1">Define and manage user roles and their permissions</p>
        </div>
        {currentUser?.role === 'super_admin' && (
          <button
            onClick={handleCreateRole}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Create Role</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <span className="material-symbols-outlined">search</span>
          </span>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRoles.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">admin_panel_settings</span>
              <p className="font-medium">No roles found</p>
            </div>
          </div>
        ) : (
          filteredRoles.map((role) => {
            const permissionCount = role.permissions?.length || 0;
            return (
              <div key={role.id} className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-black text-gray-900 dark:text-gray-100">{role.name}</h3>
                      {role.isSystem && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                          System
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-gray-500 mb-3">{role.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <span className="font-bold">{permissionCount}</span> permissions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    {role.createdAt && formatDate(role.createdAt.toDate())}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewRole(role)}
                      className="text-blue-600 hover:text-blue-700 transition-colors"
                      title="View role details"
                    >
                      <span className="material-symbols-outlined text-xl">visibility</span>
                    </button>
                    <button
                      onClick={() => handleEditRole(role)}
                      className="text-primary hover:text-primary-hover transition-colors"
                      title="Edit role"
                      disabled={role.isSystem}
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </button>
                    {!role.isSystem && currentUser?.role === 'super_admin' && (
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={processing === role.id}
                        className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Delete role"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Role Form Modal - Simplified for now */}
      {isModalOpen && (
        <RoleFormModal
          role={selectedRole}
          isOpen={isModalOpen}
          viewMode={isViewMode}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRole(null);
            setIsViewMode(false);
          }}
          onSave={handleSaveRole}
          availablePermissions={availablePermissions}
        />
      )}
    </div>
  );
};

// Simple Role Form Modal
interface RoleFormModalProps {
  role: RoleDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (roleData: Partial<RoleDefinition>) => Promise<void>;
  availablePermissions: Permission[];
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({
  role,
  isOpen,
  viewMode: initialViewMode = false,
  onClose,
  onSave,
  availablePermissions
}) => {
  const [formData, setFormData] = useState<Partial<RoleDefinition>>({
    name: '',
    description: '',
    permissions: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(initialViewMode);

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || '',
        description: role.description || '',
        permissions: role.permissions || []
      });
      // Use initialViewMode or default to system role check
      setViewMode(initialViewMode || role.isSystem || false);
    } else {
      setFormData({
        name: '',
        description: '',
        permissions: []
      });
      setViewMode(false);
    }
    setError(null);
  }, [role, isOpen, initialViewMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError('Role name is required');
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    const current = formData.permissions || [];
    const newPermissions = current.includes(permissionId)
      ? current.filter(p => p !== permissionId)
      : [...current, permissionId];
    setFormData({ ...formData, permissions: newPermissions });
  };

  if (!isOpen) return null;

  const permissionsByCategory = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">
              {viewMode ? 'View Role' : role ? 'Edit Role' : 'Create New Role'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {viewMode 
                ? 'View role information and permissions' 
                : role 
                  ? 'Update role information and permissions' 
                  : 'Define a new role with specific permissions'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {viewMode && role && !role.isSystem && (
              <button
                onClick={() => setViewMode(false)}
                className="text-primary hover:text-primary-hover transition-colors"
                title="Edit role"
              >
                <span className="material-symbols-outlined text-xl">edit</span>
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Role Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Manager, Editor"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              required
              disabled={role?.isSystem || viewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this role can do..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={viewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Permissions *</label>
            <div className="border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto space-y-4">
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category}>
                  <h4 className="text-sm font-bold text-gray-700 mb-2 capitalize">{category}</h4>
                  <div className="space-y-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions?.includes(perm.id) || false}
                          onChange={() => handlePermissionToggle(perm.id)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          disabled={viewMode}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{perm.name}</p>
                          {perm.description && (
                            <p className="text-xs text-gray-500">{perm.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {formData.permissions && formData.permissions.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {formData.permissions.length} permission(s) selected
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              {viewMode ? 'Close' : 'Cancel'}
            </button>
            {!viewMode && (
              <button
                type="submit"
                className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || role?.isSystem}
              >
                {loading ? 'Saving...' : role ? 'Update Role' : 'Create Role'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleManagement;

