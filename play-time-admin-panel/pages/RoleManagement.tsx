import React, { useState, useEffect, useMemo } from 'react';
import { rolesCollection, permissionsCollection } from '../services/firebase';
import { RoleDefinition, Permission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { DEFAULT_PERMISSIONS, SYSTEM_ROLES, mergeWithSystemRoles, mergeWithDefaultPermissions } from '../utils/rbac';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

const RoleManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showError, showWarning } = useToast();
  const { openConfirm, confirmDialog } = useConfirmDialog();
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch custom roles from Firestore
        const customRoles = await rolesCollection.getAll() as RoleDefinition[];
        
        // Combine system roles with custom roles (Firestore overrides system defaults)
        const allRoles = mergeWithSystemRoles(customRoles);
        
        setRoles(allRoles);
        
        // Fetch permissions from Firestore
        try {
          const customPermissions = await permissionsCollection.getAll() as Permission[];
          setAvailablePermissions(mergeWithDefaultPermissions(customPermissions));
        } catch (permErr) {
          console.error('Error fetching permissions:', permErr);
          // Use default permissions if fetch fails
          setAvailablePermissions(DEFAULT_PERMISSIONS);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching roles:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch roles'));
        // Fallback to system roles only
        setRoles(SYSTEM_ROLES);
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
        // Use an upsert (setDocument with merge) so that editing a system role
        // — which has no pre-existing Firestore document — persists as an override
        // instead of failing with "No document to update".
        await rolesCollection.create(selectedRole.id, {
          id: selectedRole.id,
          ...roleData,
          isSystem: selectedRole.isSystem || false,
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
      
      // Refresh roles from Firestore (Firestore overrides system defaults)
      const customRoles = await rolesCollection.getAll() as RoleDefinition[];
      setRoles(mergeWithSystemRoles(customRoles));
    } catch (err: any) {
      console.error('Error saving role:', err);
      setProcessing(null);
      showError(`Failed to save role: ${getFirebaseErrorMessage(err)}`);
    }
  };

  const handleDeleteRole = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.isSystem) {
      showWarning('System roles cannot be deleted');
      return;
    }

    openConfirm({
      title: 'Delete role?',
      message: 'Users with this role will need to be reassigned.',
      onConfirm: async () => {
        try {
          setProcessing(roleId);
          await rolesCollection.delete(roleId);
          setProcessing(null);

          const customRoles = await rolesCollection.getAll() as RoleDefinition[];
          setRoles(mergeWithSystemRoles(customRoles));
        } catch (err: any) {
          console.error('Error deleting role:', err);
          setProcessing(null);
          showError(`Failed to delete role: ${getFirebaseErrorMessage(err)}`);
        }
      },
    });
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
    <div className="p-4 sm:p-6 space-y-6">
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
                    {currentUser?.role === 'super_admin' && (
                      <button
                        onClick={() => handleEditRole(role)}
                        className="text-primary hover:text-primary-hover transition-colors"
                        title={role.isSystem ? 'Edit system role permissions' : 'Edit role'}
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                    )}
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
      {confirmDialog}
    </div>
  );
};

// Simple Role Form Modal
interface RoleFormModalProps {
  role: RoleDefinition | null;
  isOpen: boolean;
  viewMode?: boolean;
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
      // Respect the requested view mode. System roles are now editable by super admins,
      // so we no longer force them into a read-only state.
      setViewMode(initialViewMode || false);
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
      setError(getFirebaseErrorMessage(err, 'Failed to save role'));
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
            {viewMode && role && (
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
            {role?.isSystem && !viewMode && (
              <p className="text-xs text-gray-500 mt-1">
                System role name is locked, but you can still adjust its description and permissions.
              </p>
            )}
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
                disabled={loading}
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

