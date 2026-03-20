import React, { useState, useEffect } from 'react';
import { getActivityLogs, ActivityLogEntry } from '../services/firebase';
import { useUsers } from '../hooks/useUsers';
import { formatDateTime } from '../utils/dateUtils';

const ACTIVITY_ACTIONS = [
  '',
  'booking_cancelled',
  'booking_rejected',
  'booking_confirmed',
  'user_role_changed',
  'venue_updated',
  'court_created',
  'court_deleted',
];

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const { users } = useUsers({});

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await getActivityLogs({
        userId: userIdFilter || undefined,
        action: actionFilter || undefined,
        limitCount: 200,
      });
      setLogs(entries);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load activity log');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [userIdFilter, actionFilter]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-foreground-light dark:text-foreground-dark">
          Activity log
        </h1>
        <p className="text-sm text-muted-light dark:text-muted-dark">
          Audit trail of sensitive actions (super admin only).
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground-light dark:text-foreground-dark">User</span>
            <select
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email ?? u.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground-light dark:text-foreground-dark">Action</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="">All actions</option>
              {ACTIVITY_ACTIONS.filter(Boolean).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={loadLogs}
            className="px-4 py-2 rounded-lg bg-primary text-primary-content text-sm font-medium hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-light dark:text-muted-dark">
          No activity log entries found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-light dark:border-border-dark">
          <table className="w-full text-sm">
            <thead className="bg-muted-light/50 dark:bg-muted-dark/20">
              <tr>
                <th className="text-left p-3 font-medium text-foreground-light dark:text-foreground-dark">Time</th>
                <th className="text-left p-3 font-medium text-foreground-light dark:text-foreground-dark">User</th>
                <th className="text-left p-3 font-medium text-foreground-light dark:text-foreground-dark">Action</th>
                <th className="text-left p-3 font-medium text-foreground-light dark:text-foreground-dark">Target</th>
                <th className="text-left p-3 font-medium text-foreground-light dark:text-foreground-dark">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {logs.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted-light/30 dark:hover:bg-muted-dark/10">
                  <td className="p-3 text-muted-light dark:text-muted-dark whitespace-nowrap">
                    {entry.createdAt ? formatDateTime(entry.createdAt) : '—'}
                  </td>
                  <td className="p-3">
                    <span className="text-foreground-light dark:text-foreground-dark">{entry.userEmail ?? entry.userId}</span>
                  </td>
                  <td className="p-3">
                    <code className="text-xs bg-muted-light dark:bg-muted-dark px-2 py-1 rounded">{entry.action}</code>
                  </td>
                  <td className="p-3">
                    <span className="text-foreground-light dark:text-foreground-dark">{entry.targetType}</span>
                    <span className="text-muted-light dark:text-muted-dark ml-1">#{entry.targetId.slice(0, 8)}</span>
                  </td>
                  <td className="p-3 max-w-xs truncate text-muted-light dark:text-muted-dark">
                    {Object.keys(entry.details ?? {}).length > 0
                      ? JSON.stringify(entry.details)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
