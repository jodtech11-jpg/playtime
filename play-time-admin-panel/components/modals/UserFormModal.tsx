import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Permission, RoleDefinition, User } from '../../types';
import { useVenues } from '../../hooks/useVenues';
import { useAuth } from '../../contexts/AuthContext';
import { rolesCollection, permissionsCollection } from '../../services/firebase';
import { mergeWithDefaultPermissions, SYSTEM_ROLE_IDS } from '../../utils/rbac';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';

interface UserFormModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Partial<User>, options?: { sendPasswordSetupEmail?: boolean }) => Promise<void>;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave
}) => {
  const { user: currentUser } = useAuth();
  const { venues } = useVenues({ realtime: true });
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    phone: '',
    role: 'player', // Default to 'player' for regular users (mobile app users)
    status: 'Active',
    managedVenues: [],
    customPermissions: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sendPasswordSetupEmail, setSendPasswordSetupEmail] = useState(true);
  const [customRoles, setCustomRoles] = useState<RoleDefinition[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [showPermissionsEditor, setShowPermissionsEditor] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isCurrentUserSuperAdmin = currentUser?.role === 'super_admin';

  // Roles that are venue/vendor scoped (venue_manager + custom roles) need venue assignment.
  const isScopedAdminRole = (role: string | undefined) =>
    !!role && role !== 'player' && role !== 'super_admin';

  // Load custom roles + permission catalog so super admins can assign them.
  useEffect(() => {
    if (!isOpen || !isCurrentUserSuperAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const [roleDocs, permissionDocs] = await Promise.all([
          rolesCollection.getAll() as Promise<RoleDefinition[]>,
          permissionsCollection.getAll() as Promise<Permission[]>,
        ]);
        if (cancelled) return;
        setCustomRoles(roleDocs.filter(r => !(SYSTEM_ROLE_IDS as readonly string[]).includes(r.id)));
        setAvailablePermissions(mergeWithDefaultPermissions(permissionDocs));
      } catch (err) {
        console.error('Failed to load roles/permissions catalog:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isCurrentUserSuperAdmin]);

  const validatePhone = (value: string): string | null => {
    const trimmed = (value || '').trim();
    if (!trimmed) return 'Phone number is required';
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return 'Phone must have 10–15 digits';
    if (digits.startsWith('91') && digits.length === 12) {
      return /^91[6-9]\d{9}$/.test(digits) ? null : 'Invalid Indian number (e.g. +91 9876543210)';
    }
    if (digits.length === 10) {
      return /^[6-9]\d{9}$/.test(digits) ? null : 'Indian mobile must start with 6, 7, 8 or 9';
    }
    return null;
  };

  // Keyboard shortcuts: Ctrl+S / Cmd+S → save, Escape → close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Filter venues based on current user role (venue managers and custom
  // roles are limited to their own managed venues)
  const availableVenues = useMemo(() => {
    if (currentUser?.role === 'super_admin') {
      return venues;
    } else if (currentUser?.managedVenues) {
      return venues.filter(v => currentUser.managedVenues?.includes(v.id));
    }
    return [];
  }, [venues, currentUser]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'player',
        status: user.status || 'Active',
        managedVenues: user.managedVenues || [],
        customPermissions: user.customPermissions || []
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'player', // Default to 'player' for new users (mobile app users)
        status: 'Active',
        managedVenues: [],
        customPermissions: []
      });
    }
    setError(null);
    setPhoneError(null);
    setSendPasswordSetupEmail(true);
    setShowPermissionsEditor(false);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name?.trim()) {
      setError('Name is required');
      return;
    }

    if (!formData.email?.trim()) {
      setError('Email is required');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Phone validation (required field)
    const phoneErr = validatePhone(formData.phone || '');
    setPhoneError(phoneErr);
    if (phoneErr) return;

    // Venue-scoped roles (venue_manager and custom admin roles) need venues,
    // otherwise data scoping leaves them with an empty admin panel.
    if (isScopedAdminRole(formData.role as string) && (!formData.managedVenues || formData.managedVenues.length === 0)) {
      setError('Please select at least one venue for this role');
      return;
    }

    // Players and super admins are not venue-scoped
    if (!isScopedAdminRole(formData.role as string)) {
      formData.managedVenues = [];
    }

    // Custom permission grants only make sense for scoped admin roles
    if (!isScopedAdminRole(formData.role as string)) {
      formData.customPermissions = [];
    }

    try {
      setLoading(true);
      await onSave(formData, { sendPasswordSetupEmail: !user && sendPasswordSetupEmail });
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err) || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleVenueToggle = (venueId: string) => {
    const currentVenues = formData.managedVenues || [];
    const newVenues = currentVenues.includes(venueId)
      ? currentVenues.filter(id => id !== venueId)
      : [...currentVenues, venueId];

    setFormData({ ...formData, managedVenues: newVenues });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">
                {user ? 'fingerprint' : 'person_add'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                {user ? 'Edit User' : 'Add User'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {user ? 'Modify user information and permissions' : 'Create a new user account'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-8 bg-white dark:bg-slate-900 border-x border-slate-200 dark:border-slate-700">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {!user && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-blue-500 text-lg mt-0.5">info</span>
              <div className="space-y-2">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  This creates a Firebase login account and user profile. The user can sign in with email and password, Google, or phone OTP on the login page.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendPasswordSetupEmail}
                    onChange={(e) => setSendPasswordSetupEmail(e.target.checked)}
                    className="size-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Send password setup email now
                  </span>
                </label>
              </div>
            </div>
          )}

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-5 w-1 rounded-full bg-primary"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Basic Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white"
                    required
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">person</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white disabled:opacity-60"
                    required
                    disabled={!!user}
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">alternate_email</span>
                </div>
                {user && (
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email cannot be changed</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-5 w-1 rounded-full bg-blue-500"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Contact Information</h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    setPhoneError(validatePhone(e.target.value));
                  }}
                  onBlur={() => setPhoneError(validatePhone(formData.phone || ''))}
                  placeholder="+91 9876543210"
                  required
                  className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white ${
                    phoneError ? 'border-red-500 dark:border-red-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">phone_iphone</span>
              </div>
              {phoneError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 ml-1">{phoneError}</p>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-5 w-1 rounded-full bg-purple-500"></div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">User Role</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Role</label>
                <div className="relative">
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({
                        ...formData,
                        role: newRole,
                        managedVenues: isScopedAdminRole(newRole) ? formData.managedVenues : [],
                        customPermissions: isScopedAdminRole(newRole) ? formData.customPermissions : []
                      });
                    }}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                    required
                    disabled={!isCurrentUserSuperAdmin}
                  >
                    <option value="player">Player</option>
                    <option value="venue_manager">Vendor</option>
                    {isCurrentUserSuperAdmin && (
                      <option value="super_admin">Admin</option>
                    )}
                    {isCurrentUserSuperAdmin && customRoles.length > 0 && (
                      <optgroup label="Custom roles">
                        {customRoles.map((role) => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">shield_person</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
                <div className="relative">
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none"
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">verified_user</span>
                </div>
              </div>
            </div>
          </section>

          {/* Managed Venues (venue managers and custom venue-scoped roles) */}
          {isScopedAdminRole(formData.role as string) && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-amber-500"></div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Venue Access</h3>
              </div>

              <div className="ui-card p-4 border-dashed bg-slate-50 dark:bg-slate-800/30 max-h-60 overflow-y-auto space-y-2">
                {venues.length === 0 ? (
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-8">No venues available</p>
                ) : (
                  (isCurrentUserSuperAdmin ? venues : availableVenues).map((venue) => (
                    <label
                      key={venue.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-primary/30 hover:scale-[1.01] transition-all group"
                    >
                      <input
                        type="checkbox"
                        checked={formData.managedVenues?.includes(venue.id) || false}
                        onChange={() => handleVenueToggle(venue.id)}
                        className="size-5 text-primary border-slate-200 dark:border-slate-700 rounded-lg focus:ring-primary/20"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{venue.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{venue.address}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Extra permission grants beyond the role (super admin only) */}
          {isCurrentUserSuperAdmin && isScopedAdminRole(formData.role as string) && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-1 rounded-full bg-emerald-500"></div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                    Extra Permissions
                    {(formData.customPermissions?.length || 0) > 0 && (
                      <span className="ml-2 text-emerald-500">({formData.customPermissions?.length})</span>
                    )}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPermissionsEditor((v) => !v)}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  {showPermissionsEditor ? 'Hide' : 'Edit'}
                </button>
              </div>
              <p className="text-[11px] font-bold text-slate-400 -mt-4 ml-4">
                Grants in addition to the permissions of the selected role.
              </p>
              {showPermissionsEditor && (
                <div className="ui-card p-4 border-dashed bg-slate-50 dark:bg-slate-800/30 max-h-72 overflow-y-auto space-y-4">
                  {availablePermissions.length === 0 ? (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-8">No permissions available</p>
                  ) : (
                    Object.entries(
                      availablePermissions.reduce((acc, perm) => {
                        (acc[perm.category] = acc[perm.category] || []).push(perm);
                        return acc;
                      }, {} as Record<string, Permission[]>)
                    ).map(([category, perms]) => (
                      <div key={category}>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{category}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-primary/30 transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={formData.customPermissions?.includes(perm.id) || false}
                                onChange={() => {
                                  const current = formData.customPermissions || [];
                                  setFormData({
                                    ...formData,
                                    customPermissions: current.includes(perm.id)
                                      ? current.filter((id) => id !== perm.id)
                                      : [...current, perm.id],
                                  });
                                }}
                                className="size-4 text-primary border-slate-200 dark:border-slate-700 rounded focus:ring-primary/20"
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{perm.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          )}

          {/* Info message for new users */}
          {!user && (
            <div className="rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-6">
              <div className="flex gap-4">
                <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">How login works</p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    After creation, the user receives a password setup email (if checked above). They open the link, set a password, then sign in at the admin login page with email/password, Google, or phone.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 p-4 sm:p-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:border-slate-300"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-10 py-3.5 text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">{user ? 'sync' : 'add_circle'}</span>
              )}
              {loading ? 'Processing...' : user ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;

