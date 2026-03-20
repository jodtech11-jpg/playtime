import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersCollection, auth } from '../services/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { useVenues } from '../hooks/useVenues';
import { useBookings } from '../hooks/useBookings';
import { useMemberships } from '../hooks/useMemberships';
import { getStatusColor } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import ImageUpload from '../components/shared/ImageUpload';
import { useToast } from '../contexts/ToastContext';

const Profile: React.FC = () => {
  const { user, firebaseUser, refreshUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { venues } = useVenues({ realtime: true });
  const { bookings } = useBookings({ realtime: true });
  const { memberships } = useMemberships({ realtime: true });

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    avatar: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  // Filter data for current user
  const userBookings = bookings.filter(b => b.userId === user?.id);
  const userMemberships = memberships.filter(m => m.userId === user?.id);
  const managedVenueNames = user?.managedVenues
    ?.map(venueId => venues.find(v => v.id === venueId)?.name)
    .filter(Boolean) || [];

  const handleSaveProfile = async () => {
    if (!user || !firebaseUser) return;

    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        setError('Name is required');
        setLoading(false);
        return;
      }

      // Update user document
      await usersCollection.update(user.id, {
        name: formData.name.trim(),
        phone: formData.phone?.trim() || '',
        avatar: formData.avatar || '',
        updatedAt: serverTimestamp(),
      });

      // Refresh user data
      await refreshUser();
      setIsEditing(false);
      showSuccess('Profile updated successfully');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
      showError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!firebaseUser || !user?.email) return;

    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!passwordData.currentPassword) {
        setError('Current password is required');
        setLoading(false);
        return;
      }

      if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setError('New passwords do not match');
        setLoading(false);
        return;
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, passwordData.newPassword);

      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsChangingPassword(false);
      showSuccess('Password changed successfully');
    } catch (err: any) {
      console.error('Error changing password:', err);
      if (err.code === 'auth/wrong-password') {
        setError('Current password is incorrect');
      } else if (err.code === 'auth/weak-password') {
        setError('New password is too weak');
      } else {
        setError(err.message || 'Failed to change password');
      }
      showError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(user.status);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">My Profile</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>
        {!isEditing && !isChangingPassword && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              Edit Profile
            </button>
            <button
              onClick={() => setIsChangingPassword(true)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-lg">lock</span>
              Change Password
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-6">Profile Information</h2>

            {!isEditing ? (
              <div className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <div className="size-24 rounded-full bg-cover bg-center bg-no-repeat border-4 border-primary shadow-lg"
                    style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : 'none', backgroundColor: user.avatar ? 'transparent' : '#e5e7eb' }}>
                    {!user.avatar && (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
                        <span className="material-symbols-outlined">person</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-gray-100">{user.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mt-2 ${statusColors.bg} ${statusColors.text}`}>
                      {user.status}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Role</label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {user.role === 'super_admin'
                        ? 'Super Admin'
                        : user.role === 'venue_manager'
                          ? 'Venue Manager'
                          : 'Player'}
                    </p>
                  </div>
                  {user.createdAt && (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Member Since</label>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatDate(user.createdAt.toDate())}
                      </p>
                    </div>
                  )}
                  {user.updatedAt && (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Last Updated</label>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatDate(user.updatedAt.toDate())}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Avatar Upload */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Profile Picture</label>
                  <div className="mt-2">
                    <ImageUpload
                      value={formData.avatar ? [formData.avatar] : []}
                      onChange={(urls) => setFormData({ ...formData, avatar: urls[0] || '' })}
                      folder="users"
                      itemId={`${user.id}/avatar`}
                      maxImages={1}
                      multiple={false}
                    />
                    <p className="text-xs text-gray-400 mt-2">Upload a profile picture (max 5MB, JPG/PNG)</p>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="9876543210"
                  />
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Email Address</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setError(null);
                      // Reset form data
                      if (user) {
                        setFormData({
                          name: user.name || '',
                          phone: user.phone || '',
                          avatar: user.avatar || '',
                        });
                      }
                    }}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Change Password Card */}
          {isChangingPassword && (
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <h2 className="text-lg font-black text-gray-900 mb-6">Change Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Current Password *</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter current password"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">New Password *</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter new password (min 6 characters)"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Confirm New Password *</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsChangingPassword(false);
                      setError(null);
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Stats & Info */}
        <div className="space-y-6">
          {/* Account Stats */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 mb-4">Account Statistics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-600">event</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500">Total Bookings</p>
                    <p className="text-lg font-black text-gray-900">{userBookings.length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600">card_membership</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500">Memberships</p>
                    <p className="text-lg font-black text-gray-900">{userMemberships.length}</p>
                  </div>
                </div>
              </div>
              {user.role === 'venue_manager' && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-orange-600">storefront</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500">Managed Venues</p>
                      <p className="text-lg font-black text-gray-900">{managedVenueNames.length}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Managed Venues */}
          {user.role === 'venue_manager' && managedVenueNames.length > 0 && (
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
              <h2 className="text-lg font-black text-gray-900 mb-4">Managed Venues</h2>
              <div className="space-y-2">
                {managedVenueNames.map((venueName, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="material-symbols-outlined text-gray-600 text-lg">location_on</span>
                    <span className="text-sm font-semibold text-gray-700">{venueName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">User ID</p>
                <p className="text-xs font-mono text-gray-700 break-all">{user.id}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Account Status</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusColors.bg} ${statusColors.text}`}>
                  {user.status}
                </span>
              </div>
              {user.role && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">Role</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {user.role === 'super_admin'
                      ? 'Super Admin'
                      : user.role === 'venue_manager'
                        ? 'Venue Manager'
                        : 'Player'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

