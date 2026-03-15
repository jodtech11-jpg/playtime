import React, { useMemo } from 'react';
import { Report, Post } from '../../types';
import { formatDate, getRelativeTime } from '../../utils/dateUtils';

interface HistoryLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: Report[];
  posts: Post[];
  users: Array<{ id: string; name?: string; email?: string }>;
}

interface HistoryEntry {
  id: string;
  type: 'Post Removed' | 'User Banned' | 'Report Dismissed' | 'Post Approved' | 'Post Rejected' | 'Report Action Taken';
  action: string;
  postId?: string;
  postContent?: string;
  userId?: string;
  userName?: string;
  reporterName?: string;
  reason?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  timestamp: any;
  reportId?: string;
}

const HistoryLogModal: React.FC<HistoryLogModalProps> = ({
  isOpen,
  onClose,
  reports,
  posts,
  users
}) => {
  // Generate history entries from reports and posts
  const historyEntries = useMemo<HistoryEntry[]>(() => {
    const entries: HistoryEntry[] = [];

    // Add entries from reports
    reports.forEach(report => {
      if (report.status !== 'Pending') {
        const post = posts.find(p => p.id === report.postId);
        const reviewer = users.find(u => u.id === report.reviewedBy);
        const reporter = users.find(u => u.id === report.reporterId);

        let type: HistoryEntry['type'] = 'Report Dismissed';
        let action = 'Report dismissed';

        if (report.status === 'Action Taken') {
          type = 'Report Action Taken';
          action = report.actionTaken || 'Action taken on report';
        } else if (report.status === 'Dismissed') {
          type = 'Report Dismissed';
          action = 'Report dismissed - no action taken';
        }

        entries.push({
          id: report.id,
          type,
          action,
          postId: report.postId,
          postContent: post?.content?.substring(0, 100) || 'Post not found',
          userId: post?.userId,
          userName: post?.userName,
          reporterName: report.reporterName || reporter?.name || 'Unknown',
          reason: report.reason,
          reviewedBy: report.reviewedBy,
          reviewedByName: reviewer?.name || 'Unknown Moderator',
          timestamp: report.reviewedAt || report.updatedAt || report.createdAt,
          reportId: report.id
        });
      }
    });

    // Add entries from posts with status changes (excluding Pending)
    posts.forEach(post => {
      if (post.status && post.status !== 'Pending' && post.status !== 'Approved' && post.updatedAt) {
        const postUser = users.find(u => u.id === post.userId);
        
        let type: HistoryEntry['type'] | null = null;
        let action = '';

        if (post.status === 'Removed') {
          type = 'Post Removed';
          action = 'Post removed from feed';
        } else if (post.status === 'Rejected') {
          type = 'Post Rejected';
          action = 'Post rejected';
        } else if (post.status === 'Approved' && post.updatedAt) {
          // Only show approved if it was updated (not initial creation)
          const createdAt = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
          const updatedAt = post.updatedAt?.toDate ? post.updatedAt.toDate() : new Date(post.updatedAt);
          if (updatedAt.getTime() > createdAt.getTime() + 1000) { // More than 1 second difference
            type = 'Post Approved';
            action = 'Post approved and published';
          }
        }

        if (type) {
          entries.push({
            id: `post-${post.id}`,
            type,
            action,
            postId: post.id,
            postContent: post.content?.substring(0, 100) || '',
            userId: post.userId,
            userName: post.userName || postUser?.name || 'Unknown User',
            timestamp: post.updatedAt || post.createdAt
          });
        }
      }
    });

    // Sort by timestamp (newest first)
    return entries.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });
  }, [reports, posts, users]);

  const getActionIcon = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'Post Removed':
        return 'delete';
      case 'User Banned':
        return 'person_off';
      case 'Report Dismissed':
        return 'cancel';
      case 'Post Approved':
        return 'check_circle';
      case 'Post Rejected':
        return 'close';
      case 'Report Action Taken':
        return 'gavel';
      default:
        return 'history';
    }
  };

  const getActionColor = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'Post Removed':
      case 'User Banned':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30';
      case 'Report Dismissed':
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
      case 'Post Approved':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30';
      case 'Post Rejected':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30';
      case 'Report Action Taken':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const getActionIconColor = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'Post Removed':
      case 'User Banned':
        return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400';
      case 'Report Dismissed':
        return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
      case 'Post Approved':
        return 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400';
      case 'Post Rejected':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400';
      case 'Report Action Taken':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
      default:
        return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-surface-dark z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">Moderation History Log</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Complete record of all moderation actions</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {historyEntries.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">history</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No moderation history found</p>
              <p className="text-sm text-gray-400 mt-2">Actions taken will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyEntries.map((entry) => {
                const timestamp = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
                
                return (
                  <div
                    key={entry.id}
                    className={`border rounded-xl p-4 ${getActionColor(entry.type)}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${getActionIconColor(entry.type)}`}>
                        <span className="material-symbols-outlined text-xl">
                          {getActionIcon(entry.type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <h4 className="font-black text-gray-900 dark:text-gray-100 mb-1">{entry.type}</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{entry.action}</p>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {getRelativeTime(entry.timestamp)}
                          </span>
                        </div>

                        {entry.postContent && (
                          <div className="mt-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Post Content</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                              {entry.postContent}
                              {entry.postContent.length > 100 && '...'}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          {entry.userName && (
                            <div>
                              <span className="font-bold text-gray-500 dark:text-gray-400">User:</span>
                              <span className="ml-2 text-gray-700 dark:text-gray-300">{entry.userName}</span>
                            </div>
                          )}
                          {entry.reviewedByName && (
                            <div>
                              <span className="font-bold text-gray-500 dark:text-gray-400">Moderator:</span>
                              <span className="ml-2 text-gray-700 dark:text-gray-300">{entry.reviewedByName}</span>
                            </div>
                          )}
                          {entry.reason && (
                            <div>
                              <span className="font-bold text-gray-500 dark:text-gray-400">Reason:</span>
                              <span className="ml-2 text-gray-700 dark:text-gray-300">{entry.reason}</span>
                            </div>
                          )}
                          {entry.reporterName && (
                            <div>
                              <span className="font-bold text-gray-500 dark:text-gray-400">Reported By:</span>
                              <span className="ml-2 text-gray-700 dark:text-gray-300">{entry.reporterName}</span>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="font-bold text-gray-500 dark:text-gray-400">Time:</span>
                            <span className="ml-2 text-gray-700 dark:text-gray-300">{formatDate(timestamp)}</span>
                          </div>
                        </div>

                        {entry.postId && (
                          <div className="mt-2">
                            <span className="text-[10px] font-mono text-gray-400">
                              Post ID: {entry.postId.substring(0, 8).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total actions: <span className="font-bold text-gray-900 dark:text-gray-100">{historyEntries.length}</span>
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl font-black text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryLogModal;

