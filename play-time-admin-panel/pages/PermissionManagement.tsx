import React, { useState, useEffect, useMemo } from 'react';
import { permissionsCollection, rolesCollection } from '../services/firebase';
import { Permission, RoleDefinition } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatDate } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { DEFAULT_PERMISSIONS, mergeWithDefaultPermissions } from '../utils/rbac';
import { getFirebaseErrorMessage } from '../utils/errorUtils';

const PermissionManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showError, showWarning } = useToast();
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch custom permissions from Firestore and merge with defaults
        const customPermissions = await permissionsCollection.getAll() as Permission[];
        setPermissions(mergeWithDefaultPermissions(customPermissions));
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching permissions:', err);
        setError(getFirebaseErrorMessage(err, 'Failed to fetch permissions'));
        // Fallback to default permissions only
        setPermissions(DEFAULT_PERMISSIONS);
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  const filteredPermissions = useMemo(() => {
    let filtered = permissions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.resource.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'All') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    return filtered;
  }, [permissions, searchQuery, categoryFilter]);

  const handleCreatePermission = () => {
    setSelectedPermission(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setNewEntryHandler(handleCreatePermission);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  const handleEditPermission = (permission: Permission) => {
    setSelectedPermission(permission);
    setIsModalOpen(true);
  };

  const handleSavePermission = async (permissionData: Partial<Permission>) => {
    try {
      setProcessing('saving');
      
      // Generate permission ID from resource and action if not provided
      const permissionId = permissionData.id || 
        (permissionData.resource && permissionData.action 
          ? `${permissionData.resource}.${permissionData.action}`
          : `perm_${Date.now()}`);
      
      if (selectedPermission) {
        // Use an upsert (setDocument with merge) instead of updateDoc. Default
        // permissions are defined in code and may not exist as Firestore documents
        // yet, so a plain update would fail with "No document to update".
        await permissionsCollection.create(selectedPermission.id, {
          ...permissionData,
          id: selectedPermission.id, // Keep original ID
          updatedAt: serverTimestamp()
        });
      } else {
        await permissionsCollection.create(permissionId, {
          id: permissionId,
          ...permissionData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setSelectedPermission(null);
      setProcessing(null);
      
      // Refresh permissions from Firestore
      try {
        const customPermissions = await permissionsCollection.getAll() as Permission[];
        setPermissions(mergeWithDefaultPermissions(customPermissions));
      } catch (refreshErr) {
        console.error('Error refreshing permissions:', refreshErr);
        // If refresh fails, at least update local state optimistically
        if (!selectedPermission) {
          setPermissions(prev => [...prev, { ...permissionData, id: permissionId } as Permission]);
        } else {
          setPermissions(prev => prev.map(p => p.id === selectedPermission.id ? { ...p, ...permissionData } as Permission : p));
        }
      }
    } catch (err: any) {
      console.error('Error saving permission:', err);
      setProcessing(null);
      showError(`Failed to save permission: ${getFirebaseErrorMessage(err)}`);
    }
  };

  const handleDeletePermission = (permissionId: string) => {
    const isDefault = DEFAULT_PERMISSIONS.some((p) => p.id === permissionId);
    if (isDefault) {
      showWarning('Default permissions cannot be deleted. They are system-defined.');
      return;
    }

    openConfirm({
      title: 'Delete permission?',
      message: 'This may affect roles that use this permission.',
      onConfirm: async () => {
        try {
          setProcessing(permissionId);
          await permissionsCollection.delete(permissionId);

          // Cascade: strip the deleted permission ID from every role that
          // references it, so we don't leave dangling references behind.
          try {
            const allRoles = await rolesCollection.getAll() as RoleDefinition[];
            const affectedRoles = allRoles.filter(
              (role) => Array.isArray(role.permissions) && role.permissions.includes(permissionId)
            );
            await Promise.all(
              affectedRoles.map((role) =>
                rolesCollection.create(role.id, {
                  id: role.id,
                  createdAt: role.createdAt,
                  permissions: role.permissions.filter((p) => p !== permissionId),
                  updatedAt: serverTimestamp(),
                })
              )
            );
          } catch (cascadeErr) {
            console.error('Error removing permission from roles:', cascadeErr);
          }

          setProcessing(null);

          try {
            const customPermissions = await permissionsCollection.getAll() as Permission[];
            setPermissions(mergeWithDefaultPermissions(customPermissions));
          } catch (refreshErr) {
            console.error('Error refreshing permissions:', refreshErr);
            setPermissions((prevPermissions) => prevPermissions.filter((p) => p.id !== permissionId));
          }
        } catch (err: any) {
          console.error('Error deleting permission:', err);
          setProcessing(null);
          showError(`Failed to delete permission: ${getFirebaseErrorMessage(err)}`);
        }
      },
    });
  };

  const categories = ['All', ...Array.from(new Set(permissions.map(p => p.category)))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Error loading permissions</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const permissionsByCategory = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Permission Management</h1>
          <p className="text-sm text-gray-500 mt-1">Define and manage system permissions</p>
        </div>
        {currentUser?.role === 'super_admin' && (
          <button
            onClick={handleCreatePermission}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Create Permission</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <span className="material-symbols-outlined">search</span>
            </span>
          </div>
          <div className="md:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Permissions by Category */}
      <div className="space-y-6">
        {Object.keys(permissionsByCategory).length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">lock</span>
              <p className="font-medium">No permissions found</p>
            </div>
          </div>
        ) : (
          Object.entries(permissionsByCategory).map(([category, perms]) => (
            <div key={category} className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-black text-gray-900 dark:text-gray-100 capitalize">{category}</h3>
                <p className="text-xs text-gray-500 mt-1">{perms.length} permission(s)</p>
              </div>
              <div className="divide-y divide-gray-200">
                {perms.map((permission) => (
                  <div key={permission.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{permission.name}</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {permission.action}
                          </span>
                        </div>
                        {permission.description && (
                          <p className="text-sm text-gray-500 mb-2">{permission.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>Resource: {permission.resource}</span>
                          <span>ID: {permission.id}</span>
                        </div>
                      </div>
                      {currentUser?.role === 'super_admin' && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEditPermission(permission)}
                            className="text-primary hover:text-primary-hover transition-colors"
                            title="Edit permission"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeletePermission(permission.id)}
                            disabled={processing === permission.id}
                            className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                            title="Delete permission"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Permission Form Modal */}
      {isModalOpen && (
        <PermissionFormModal
          permission={selectedPermission}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPermission(null);
          }}
          onSave={handleSavePermission}
        />
      )}
      {confirmDialog}
    </div>
  );
};

// Permission Form Modal
interface PermissionFormModalProps {
  permission: Permission | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (permissionData: Partial<Permission>) => Promise<void>;
}

const PermissionFormModal: React.FC<PermissionFormModalProps> = ({
  permission,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<Permission>>({
    name: '',
    description: '',
    category: 'other',
    resource: '',
    action: 'read'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permission) {
      setFormData({
        name: permission.name || '',
        description: permission.description || '',
        category: permission.category || 'other',
        resource: permission.resource || '',
        action: permission.action || 'read'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'other',
        resource: '',
        action: 'read'
      });
    }
    setError(null);
  }, [permission, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError('Permission name is required');
      return;
    }

    if (!formData.resource?.trim()) {
      setError('Resource is required');
      return;
    }

    try {
      setLoading(true);
      const permissionId = permission?.id || `${formData.resource}.${formData.action}`;
      await onSave({ ...formData, id: permissionId });
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err, 'Failed to save permission'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {permission ? 'Edit Permission' : 'Create New Permission'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {permission ? 'Update permission details' : 'Define a new system permission'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Permission Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Create Users"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this permission allows..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="users">Users</option>
                <option value="bookings">Bookings</option>
                <option value="venues">Venues</option>
                <option value="tournaments">Tournaments</option>
                <option value="memberships">Memberships</option>
                <option value="staff">Staff</option>
                <option value="financials">Financials</option>
                <option value="marketing">Marketing</option>
                <option value="settings">Settings</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 mb-2">Action *</label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                required
              >
                <option value="read">Read</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="manage">Manage</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-gray-700 mb-2">Resource *</label>
            <input
              type="text"
              value={formData.resource}
              onChange={(e) => setFormData({ ...formData, resource: e.target.value })}
              placeholder="e.g., users, bookings, venues"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The resource this permission applies to</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : permission ? 'Update Permission' : 'Create Permission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermissionManagement;

