import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useUsers } from '../hooks/useUsers';
import { useVenues } from '../hooks/useVenues';
import { useAppSettings } from '../hooks/useAppSettings';
import { Notification } from '../types';
import { getRelativeTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { useToast } from '../contexts/ToastContext';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  // Use stable realtime parameter
  const { notifications, loading, error, createNotification, updateNotification, sendNotification, deleteNotification } = useNotifications(true);
  const { settings } = useAppSettings(false);
  
  // Only fetch users and venues when modal is open (lazy loading)
  const [showSendModal, setShowSendModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(() => {
      setShowSendModal(true);
    });
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);
  const usersOptions = useMemo(() => (showSendModal ? {} : { limit: 0 }), [showSendModal]);
  const venuesOptions = useMemo(() => ({ realtime: showSendModal }), [showSendModal]);
  const { users } = useUsers(usersOptions);
  const { venues } = useVenues(venuesOptions);

  const [selectedStatus, setSelectedStatus] = useState<Notification['status'] | 'All'>('All');
  const [selectedType, setSelectedType] = useState<Notification['type'] | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  // Check if FCM is configured - MUST be before any early returns (Rules of Hooks)
  const isFCMConfigured = useMemo(() => {
    const cloudFunctionUrl = import.meta.env.VITE_FCM_CLOUD_FUNCTION_URL;
    const serverKey = import.meta.env.VITE_FCM_SERVER_KEY;
    return !!(cloudFunctionUrl || serverKey);
  }, []);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    body: string;
    type: Notification['type'];
    targetAudience: Notification['targetAudience'];
    targetUserIds: string[];
    targetVenueId: string;
    imageUrl: string;
    actionUrl: string;
    actionText: string;
    scheduledFor: string;
    channels: ('push' | 'whatsapp')[];
  }>({
    title: '',
    body: '',
    type: 'Announcement',
    targetAudience: 'All Users',
    targetUserIds: [],
    targetVenueId: '',
    imageUrl: '',
    actionUrl: '',
    actionText: '',
    scheduledFor: '',
    channels: ['push'], // Default to push notifications
  });

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    if (selectedStatus !== 'All') {
      filtered = filtered.filter(n => n.status === selectedStatus);
    }

    if (selectedType !== 'All') {
      filtered = filtered.filter(n => n.type === selectedType);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.body.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [notifications, selectedStatus, selectedType, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = notifications.length;
    const sent = notifications.filter(n => n.status === 'Sent').length;
    const scheduled = notifications.filter(n => n.status === 'Scheduled').length;
    const drafts = notifications.filter(n => n.status === 'Draft').length;
    const totalSent = notifications.reduce((sum, n) => sum + (n.sentCount || 0), 0);

    return { total, sent, scheduled, drafts, totalSent };
  }, [notifications]);

  const handleSendNotification = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      alert('Please fill in title and body');
      return;
    }

    if (formData.channels.length === 0) {
      alert('Please select at least one delivery channel');
      return;
    }

    if (formData.targetAudience === 'Specific Users' && formData.targetUserIds.length === 0) {
      alert('Please select at least one user');
      return;
    }

    if (formData.targetAudience === 'Venue Users' && !formData.targetVenueId) {
      alert('Please select a venue');
      return;
    }

    try {
      setSending('creating');
      
      // Create notification
      const notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title,
        body: formData.body,
        type: formData.type,
        targetAudience: formData.targetAudience,
        targetUserIds: formData.targetAudience === 'Specific Users' ? formData.targetUserIds : undefined,
        targetVenueId: formData.targetAudience === 'Venue Users' ? formData.targetVenueId : undefined,
        imageUrl: formData.imageUrl || undefined,
        actionUrl: formData.actionUrl || undefined,
        actionText: formData.actionText || undefined,
        scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor) : undefined,
        status: formData.scheduledFor ? 'Scheduled' : 'Draft',
        createdBy: user?.id || '',
      };

      const notificationId = await createNotification(notificationData);
      
      if (!notificationId) {
        throw new Error('Failed to create notification: No ID returned');
      }
      
      // If not scheduled, send immediately
      if (!formData.scheduledFor) {
        setSending(notificationId);
        await sendNotification(notificationId, { channels: formData.channels });
        showSuccess('Notification sent successfully!');
      } else {
        showSuccess('Notification scheduled successfully!');
      }

      // Reset form
      setFormData({
        title: '',
        body: '',
        type: 'Announcement',
        targetAudience: 'All Users',
        targetUserIds: [],
        targetVenueId: '',
        imageUrl: '',
        actionUrl: '',
        actionText: '',
        scheduledFor: '',
        channels: ['push'],
      });
      setShowSendModal(false);
    } catch (error: any) {
      console.error('Error sending notification:', error);
      const errorMessage = error.message || 'Failed to send notification';
      showError(errorMessage);
    } finally {
      setSending(null);
    }
  };

  const handleResendNotification = async (notificationId: string) => {
    if (!confirm('Are you sure you want to resend this notification?')) return;

    try {
      setSending(notificationId);
      // Resend with default channels (push)
      await sendNotification(notificationId, { channels: ['push'] });
      showSuccess('Notification resent successfully!');
    } catch (error: any) {
      console.error('Error resending notification:', error);
      const errorMessage = error.message || 'Failed to resend notification';
      
      // Check if it's an FCM configuration error
      if (errorMessage.includes('FCM server key not configured') || 
          errorMessage.includes('FCM')) {
        showError('Push notifications are not configured. Please set up FCM in Settings or use WhatsApp channel.');
      } else {
        showError(errorMessage);
      }
    } finally {
      setSending(null);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      await deleteNotification(notificationId);
      showSuccess('Notification deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      showError('Failed to delete notification: ' + error.message);
    }
  };

  const handleViewNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    setShowViewModal(true);
  };

  const handleEditNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    // Populate form with notification data
    setFormData({
      title: notification.title,
      body: notification.body,
      type: notification.type,
      targetAudience: notification.targetAudience,
      targetUserIds: notification.targetUserIds || [],
      targetVenueId: notification.targetVenueId || '',
      imageUrl: notification.imageUrl || '',
      actionUrl: notification.actionUrl || '',
      actionText: notification.actionText || '',
      scheduledFor: notification.scheduledFor 
        ? (notification.scheduledFor.toDate ? notification.scheduledFor.toDate().toISOString().slice(0, 16) : new Date(notification.scheduledFor).toISOString().slice(0, 16))
        : '',
      channels: ['push'], // Default
    });
    setShowEditModal(true);
  };

  const handleUpdateNotification = async () => {
    if (!selectedNotification) return;

    if (!formData.title.trim() || !formData.body.trim()) {
      showError('Please fill in title and body');
      return;
    }

    if (formData.targetAudience === 'Specific Users' && formData.targetUserIds.length === 0) {
      showError('Please select at least one user');
      return;
    }

    if (formData.targetAudience === 'Venue Users' && !formData.targetVenueId) {
      showError('Please select a venue');
      return;
    }

    try {
      setSending(selectedNotification.id);
      
      // Update notification
      const updateData: Partial<Notification> = {
        title: formData.title,
        body: formData.body,
        type: formData.type,
        targetAudience: formData.targetAudience,
        targetUserIds: formData.targetAudience === 'Specific Users' ? formData.targetUserIds : undefined,
        targetVenueId: formData.targetAudience === 'Venue Users' ? formData.targetVenueId : undefined,
        imageUrl: formData.imageUrl || undefined,
        actionUrl: formData.actionUrl || undefined,
        actionText: formData.actionText || undefined,
        scheduledFor: formData.scheduledFor ? new Date(formData.scheduledFor) : undefined,
        status: formData.scheduledFor ? 'Scheduled' : (selectedNotification.status === 'Sent' ? 'Sent' : 'Draft'),
      };

      await updateNotification(selectedNotification.id, updateData);
      showSuccess('Notification updated successfully!');
      setShowEditModal(false);
      setSelectedNotification(null);
      // Reset form
      setFormData({
        title: '',
        body: '',
        type: 'Announcement',
        targetAudience: 'All Users',
        targetUserIds: [],
        targetVenueId: '',
        imageUrl: '',
        actionUrl: '',
        actionText: '',
        scheduledFor: '',
        channels: ['push'],
      });
    } catch (error: any) {
      console.error('Error updating notification:', error);
      showError('Failed to update notification: ' + error.message);
    } finally {
      setSending(null);
    }
  };

  const getStatusColor = (status: Notification['status']) => {
    switch (status) {
      case 'Sent':
        return 'bg-green-100 text-green-800';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'Sending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && notifications.length === 0 && !error) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 font-medium">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4">error</span>
          <p className="text-gray-600 font-medium mb-2">Error loading notifications</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 bg-background-light min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Push Notifications</h2>
          <p className="text-gray-500 mt-1">Send push notifications to users and manage notification history.</p>
        </div>
        <button
          onClick={() => setShowSendModal(true)}
          className="bg-primary text-primary-content px-6 py-3 rounded-xl font-black text-sm hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined">notifications_active</span>
          Send Notification
        </button>
      </div>

      {/* FCM Configuration Warning */}
      {!isFCMConfigured && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 flex items-start gap-4">
          <span className="material-symbols-outlined text-yellow-600 text-2xl">warning</span>
          <div className="flex-1">
            <h3 className="text-lg font-black text-yellow-900 mb-2">Push Notifications Not Configured</h3>
            <p className="text-sm text-yellow-800 mb-3">
              FCM (Firebase Cloud Messaging) is not configured. Push notifications will not be sent until you set up FCM.
            </p>
            <div className="text-sm text-yellow-700 space-y-1">
              <p className="font-semibold">To enable push notifications:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Set up a Cloud Function (recommended) and add <code className="bg-yellow-100 px-1 rounded">VITE_FCM_CLOUD_FUNCTION_URL</code> to your <code className="bg-yellow-100 px-1 rounded">.env</code> file</li>
                <li>OR add <code className="bg-yellow-100 px-1 rounded">VITE_FCM_SERVER_KEY</code> to your <code className="bg-yellow-100 px-1 rounded">.env</code> file (not recommended for production)</li>
              </ol>
              <p className="mt-2 text-xs">
                See <code className="bg-yellow-100 px-1 rounded">docs/implementations/FCM_IMPLEMENTATION.md</code> for detailed setup instructions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="text-3xl font-black text-gray-900 dark:text-gray-100">{stats.total}</div>
          <div className="text-sm text-gray-500 mt-1 font-medium">Total Notifications</div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="text-3xl font-black text-green-600">{stats.sent}</div>
          <div className="text-sm text-gray-500 mt-1 font-medium">Sent</div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="text-3xl font-black text-blue-600">{stats.scheduled}</div>
          <div className="text-sm text-gray-500 mt-1 font-medium">Scheduled</div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="text-3xl font-black text-gray-600">{stats.drafts}</div>
          <div className="text-sm text-gray-500 mt-1 font-medium">Drafts</div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="text-3xl font-black text-primary">{stats.totalSent.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1 font-medium">Total Recipients</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="All">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Sending">Sending</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
          </select>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="All">All Types</option>
            <option value="Announcement">Announcement</option>
            <option value="Booking">Booking</option>
            <option value="Membership">Membership</option>
            <option value="Tournament">Tournament</option>
            <option value="Promotion">Promotion</option>
            <option value="System">System</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
            Notification History ({filteredNotifications.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">notifications_off</span>
              <p className="text-gray-500 font-medium">No notifications found</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div key={notification.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-black text-gray-900">{notification.title}</h4>
                      <span className={`px-2 py-1 rounded-lg text-xs font-black uppercase ${getStatusColor(notification.status)}`}>
                        {notification.status}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                        {notification.type}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{notification.body}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">group</span>
                        {notification.targetAudience}
                      </span>
                      {notification.sentCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">send</span>
                          {notification.sentCount} sent
                        </span>
                      )}
                      {notification.failedCount !== undefined && notification.failedCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <span className="material-symbols-outlined text-base">error</span>
                          {notification.failedCount} failed
                        </span>
                      )}
                      {notification.sentAt && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">schedule</span>
                          Sent {getRelativeTime(notification.sentAt)}
                        </span>
                      )}
                      {notification.createdAt && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">calendar_today</span>
                          Created {getRelativeTime(notification.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewNotification(notification)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    {notification.status === 'Draft' && (
                      <>
                        <button
                          onClick={() => handleEditNotification(notification)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          onClick={() => handleResendNotification(notification.id)}
                          disabled={sending === notification.id}
                          className="px-4 py-2 bg-primary text-primary-content rounded-lg text-sm font-black hover:shadow-lg transition-all disabled:opacity-50"
                        >
                          {sending === notification.id ? 'Sending...' : 'Send Now'}
                        </button>
                      </>
                    )}
                    {notification.status === 'Failed' && (
                      <button
                        onClick={() => handleResendNotification(notification.id)}
                        disabled={sending === notification.id}
                        className="px-4 py-2 bg-primary text-primary-content rounded-lg text-sm font-black hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {sending === notification.id ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Send Notification Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900">Send Push Notification</h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notification title"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Message *
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Notification message"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Notification['type'] })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Announcement">Announcement</option>
                    <option value="Booking">Booking</option>
                    <option value="Membership">Membership</option>
                    <option value="Tournament">Tournament</option>
                    <option value="Promotion">Promotion</option>
                    <option value="System">System</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Target Audience
                  </label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value as Notification['targetAudience'], targetUserIds: [], targetVenueId: '' })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="All Users">All Users</option>
                    <option value="Venue Managers">Venue Managers</option>
                    <option value="Specific Users">Specific Users</option>
                    <option value="Venue Users">Venue Users</option>
                  </select>
                </div>
              </div>
              {formData.targetAudience === 'Specific Users' && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Select Users
                  </label>
                  <select
                    multiple
                    value={formData.targetUserIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setFormData({ ...formData, targetUserIds: selected });
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                  >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple users</p>
                </div>
              )}
              {formData.targetAudience === 'Venue Users' && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Select Venue
                  </label>
                  <select
                    value={formData.targetVenueId}
                    onChange={(e) => setFormData({ ...formData, targetVenueId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a venue</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Action URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.actionUrl}
                    onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                    placeholder="Deep link or URL"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    Action Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.actionText}
                    onChange={(e) => setFormData({ ...formData, actionText: e.target.value })}
                    placeholder="e.g., View Booking"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Schedule For (Optional - Leave empty to send now)
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledFor}
                  onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              {/* Channel Selection */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Delivery Channels
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes('push')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, channels: [...formData.channels, 'push'] });
                        } else {
                          setFormData({ ...formData, channels: formData.channels.filter(c => c !== 'push') });
                        }
                      }}
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">notifications</span>
                        <span className="font-bold text-gray-900">Push Notifications</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Send via Firebase Cloud Messaging</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer ${
                    settings?.integrations?.whatsapp?.enabled && settings?.integrations?.whatsapp?.status === 'Connected'
                      ? 'border-gray-200 hover:bg-gray-50'
                      : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.channels.includes('whatsapp')}
                      disabled={!settings?.integrations?.whatsapp?.enabled || settings?.integrations?.whatsapp?.status !== 'Connected'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, channels: [...formData.channels, 'whatsapp'] });
                        } else {
                          setFormData({ ...formData, channels: formData.channels.filter(c => c !== 'whatsapp') });
                        }
                      }}
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-600">chat</span>
                        <span className="font-bold text-gray-900">WhatsApp</span>
                        {(!settings?.integrations?.whatsapp?.enabled || settings?.integrations?.whatsapp?.status !== 'Connected') && (
                          <span className="text-xs text-gray-500">(Not configured)</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Send via WhatsApp Business API</p>
                    </div>
                  </label>
                </div>
                {formData.channels.length === 0 && (
                  <p className="text-xs text-red-600 mt-2">Please select at least one delivery channel</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotification}
                disabled={sending !== null}
                className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50"
              >
                {sending === 'creating' ? 'Sending...' : formData.scheduledFor ? 'Schedule' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Notification Modal */}
      {showViewModal && selectedNotification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Notification Details</h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedNotification(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Title</label>
                  <p className="text-lg font-black text-gray-900">{selectedNotification.title}</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Body</label>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedNotification.body}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Type</label>
                    <p className="text-gray-900 font-medium">{selectedNotification.type}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Status</label>
                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-black uppercase ${getStatusColor(selectedNotification.status)}`}>
                      {selectedNotification.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Target Audience</label>
                  <p className="text-gray-900 font-medium">{selectedNotification.targetAudience}</p>
                </div>

                {selectedNotification.imageUrl && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Image</label>
                    <img src={selectedNotification.imageUrl} alt="Notification" className="w-full rounded-xl max-h-64 object-cover" />
                  </div>
                )}

                {(selectedNotification.actionUrl || selectedNotification.actionText) && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Action</label>
                    <div className="space-y-2">
                      {selectedNotification.actionText && (
                        <p className="text-gray-900 font-medium">{selectedNotification.actionText}</p>
                      )}
                      {selectedNotification.actionUrl && (
                        <a href={selectedNotification.actionUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {selectedNotification.actionUrl}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Sent Count</label>
                    <p className="text-2xl font-black text-green-600">{selectedNotification.sentCount || 0}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Failed Count</label>
                    <p className="text-2xl font-black text-red-600">{selectedNotification.failedCount || 0}</p>
                  </div>
                </div>

                {selectedNotification.failedCount && selectedNotification.failedCount > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-900 mb-2">Why did this fail?</p>
                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                      <li>No FCM tokens registered for target users</li>
                      <li>FCM tokens may have expired or been invalidated</li>
                      <li>Users may have uninstalled the app or logged out</li>
                      <li>Network issues during delivery</li>
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  {selectedNotification.createdAt && (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Created</label>
                      <p className="text-gray-700">{getRelativeTime(selectedNotification.createdAt)}</p>
                    </div>
                  )}
                  {selectedNotification.sentAt && (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Sent</label>
                      <p className="text-gray-700">{getRelativeTime(selectedNotification.sentAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                {selectedNotification.status === 'Draft' && (
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      handleEditNotification(selectedNotification);
                    }}
                    className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedNotification(null);
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notification Modal */}
      {showEditModal && selectedNotification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-gray-900">Edit Notification</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedNotification(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Use the same form as Send Modal */}
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Notification title"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Body *</label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Notification message"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as Notification['type'] })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Announcement">Announcement</option>
                      <option value="Booking">Booking</option>
                      <option value="Membership">Membership</option>
                      <option value="Tournament">Tournament</option>
                      <option value="Promotion">Promotion</option>
                      <option value="System">System</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Target Audience</label>
                    <select
                      value={formData.targetAudience}
                      onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value as Notification['targetAudience'] })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="All Users">All Users</option>
                      <option value="Venue Managers">Venue Managers</option>
                      <option value="Specific Users">Specific Users</option>
                      <option value="Venue Users">Venue Users</option>
                    </select>
                  </div>
                </div>

                {formData.targetAudience === 'Specific Users' && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Users</label>
                    <select
                      multiple
                      value={formData.targetUserIds}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setFormData({ ...formData, targetUserIds: selected });
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                    >
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple users</p>
                  </div>
                )}

                {formData.targetAudience === 'Venue Users' && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Venue</label>
                    <select
                      value={formData.targetVenueId}
                      onChange={(e) => setFormData({ ...formData, targetVenueId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a venue</option>
                      {venues.map(venue => (
                        <option key={venue.id} value={venue.id}>{venue.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Image URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Action URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.actionUrl}
                    onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                    placeholder="Deep link or URL"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Action Text (Optional)</label>
                  <input
                    type="text"
                    value={formData.actionText}
                    onChange={(e) => setFormData({ ...formData, actionText: e.target.value })}
                    placeholder="e.g., View Booking, Open App"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Schedule For (Optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledFor}
                    onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedNotification(null);
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateNotification}
                  disabled={sending !== null}
                  className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {sending === selectedNotification.id ? 'Updating...' : 'Update Notification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;

