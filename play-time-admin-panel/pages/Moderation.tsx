import React, { useState, useMemo } from 'react';
import { usePosts, useReportedPosts, usePendingPosts } from '../hooks/usePosts';
import { useReports, usePendingReports } from '../hooks/useReports';
import { useVenues } from '../hooks/useVenues';
import { useUsers } from '../hooks/useUsers';
import { postsCollection, reportsCollection, usersCollection } from '../services/firebase';
import { Post, Report } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import HistoryLogModal from '../components/modals/HistoryLogModal';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

const Moderation: React.FC = () => {
  const { user } = useAuth();
  const { showError } = useToast();
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const { posts: allPosts } = usePosts({ realtime: true });
  const { posts: reportedPosts } = useReportedPosts();
  const { posts: pendingPosts } = usePendingPosts();
  const { reports: allReports } = useReports({ realtime: true });
  const { reports: pendingReports } = usePendingReports();
  const { venues } = useVenues({ realtime: true });
  const { users } = useUsers();

  const [filter, setFilter] = useState<'All Posts' | 'Reported' | 'Auto-Flagged' | 'Match' | 'Venue'>('All Posts');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showHistoryLog, setShowHistoryLog] = useState(false);
  const [localRemovedPostIds, setLocalRemovedPostIds] = useState<Set<string>>(new Set());

  // Calculate statistics
  const stats = useMemo(() => {
    const pendingReviews = pendingPosts.length + pendingReports.length;
    const reportedUsers = new Set(
      allReports
        .filter(r => r.status === 'Pending')
        .map(r => {
          const post = allPosts.find(p => p.id === r.postId);
          return post?.userId;
        })
        .filter(Boolean)
    ).size;
    const autoFlagged = allPosts.filter(p => p.isReported && p.reportCount && p.reportCount > 0).length;

    return {
      pendingReviews,
      reportedUsers,
      autoFlagged
    };
  }, [pendingPosts, pendingReports, allReports, allPosts]);

  // Filter posts based on selected filter
  const filteredPosts = useMemo(() => {
    let postsToShow: Post[] = [];

    switch (filter) {
      case 'Reported':
        postsToShow = reportedPosts;
        break;
      case 'Auto-Flagged':
        postsToShow = allPosts.filter(p => p.isReported && p.reportCount && p.reportCount > 0);
        break;
      case 'Match':
        postsToShow = allPosts.filter(p => p.type === 'Match');
        break;
      case 'Venue':
        postsToShow = allPosts.filter(p => p.type === 'Venue Update');
        break;
      default:
        postsToShow = allPosts;
    }

    // Hide posts that are already removed (in DB) or optimistically removed
    postsToShow = postsToShow.filter(p => 
      p.status !== 'Removed' && !localRemovedPostIds.has(p.id)
    );

    // Sort by most reported or most recent
    return postsToShow.sort((a, b) => {
      if (filter === 'Reported' || filter === 'Auto-Flagged') {
        return (b.reportCount || 0) - (a.reportCount || 0);
      }
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filter, allPosts, reportedPosts, localRemovedPostIds]);

  // Get reports for a post
  const getPostReports = (postId: string): Report[] => {
    return allReports.filter(r => r.postId === postId && r.status === 'Pending');
  };

  const handleRemovePost = (postId: string) => {
    openConfirm({
      title: 'Remove post?',
      message: 'This action cannot be undone.',
      onConfirm: async () => {
        setLocalRemovedPostIds((prev) => new Set(prev).add(postId));

        try {
          setProcessing(postId);
          await postsCollection.update(postId, {
            status: 'Removed',
            updatedAt: serverTimestamp(),
          });

          const postReports = getPostReports(postId);
          for (const report of postReports) {
            await reportsCollection.update(report.id, {
              status: 'Action Taken',
              actionTaken: 'Post Removed',
              reviewedBy: user?.id,
              reviewedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error: any) {
          console.error('Error removing post:', error);
          setLocalRemovedPostIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
          });
          showError('Failed to remove post: ' + error.message);
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  const handleBanUser = (userId: string, postId: string) => {
    openConfirm({
      title: 'Ban user?',
      message: 'They will not be able to post or interact. Their posts will be removed.',
      onConfirm: async () => {
        try {
          setProcessing(`ban-${userId}`);

          await usersCollection.update(userId, {
            status: 'Inactive',
            updatedAt: serverTimestamp(),
          });

          const userPosts = allPosts.filter((p) => p.userId === userId);
          for (const post of userPosts) {
            await postsCollection.update(post.id, {
              status: 'Removed',
              updatedAt: serverTimestamp(),
            });
          }

          const postReports = getPostReports(postId);
          for (const report of postReports) {
            await reportsCollection.update(report.id, {
              status: 'Action Taken',
              actionTaken: 'User Banned',
              reviewedBy: user?.id,
              reviewedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error: any) {
          console.error('Error banning user:', error);
          showError('Failed to ban user: ' + error.message);
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      setProcessing(`dismiss-${reportId}`);
      await reportsCollection.update(reportId, {
        status: 'Dismissed',
        reviewedBy: user?.id,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error dismissing report:', error);
      showError('Failed to dismiss report: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleApprovePost = async (postId: string) => {
    try {
      setProcessing(postId);
      await postsCollection.update(postId, {
        status: 'Approved',
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error approving post:', error);
      showError('Failed to approve post: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectPost = (postId: string) => {
    openConfirm({
      title: 'Reject post?',
      message: 'The post will be marked as rejected.',
      variant: 'warning',
      confirmLabel: 'Reject',
      onConfirm: async () => {
        try {
          setProcessing(postId);
          await postsCollection.update(postId, {
            status: 'Rejected',
            updatedAt: serverTimestamp(),
          });
        } catch (error: any) {
          console.error('Error rejecting post:', error);
          showError('Failed to reject post: ' + error.message);
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 h-full bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Feed Moderation Queue</h1>
            <p className="text-gray-500 font-medium">Review reported posts, match results, and venue updates.</p>
          </div>
          <button 
            onClick={() => setShowHistoryLog(true)}
            className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            History Log
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: "Pending Reviews",
              val: stats.pendingReviews.toString(),
              change: `+${pendingPosts.length} posts`,
              trend: "up",
              icon: "pending_actions",
              color: "text-orange-600",
              bg: "bg-orange-50"
            },
            {
              label: "Reported Users",
              val: stats.reportedUsers.toString(),
              change: "Needs review",
              trend: "up",
              icon: "person_off",
              color: "text-red-600",
              bg: "bg-red-50"
            },
            {
              label: "Auto-Flagged",
              val: stats.autoFlagged.toString(),
              change: "Multiple reports",
              trend: "neutral",
              icon: "smart_toy",
              color: "text-blue-600",
              bg: "bg-blue-50"
            }
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between h-36">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                <div className={`p-2 ${s.bg} ${s.color} rounded-lg`}>
                  <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-gray-900 dark:text-gray-100">{s.val}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ml-3 ${s.trend === 'up' ? 'text-green-600' : 'text-gray-400'}`}>{s.change}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          {['All Posts', 'Reported', 'Auto-Flagged', 'Match', 'Venue'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all ${
                filter === f
                  ? 'bg-sidebar-dark text-white shadow-xl'
                  : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-primary/50'
              }`}
            >
              {f}
              {f === 'All Posts' && <span className="opacity-40 ml-1">{allPosts.length}</span>}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 items-start pb-10">
          {filteredPosts.length === 0 ? (
            <div className="lg:col-span-2 text-center py-12">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">check_circle</span>
              <p className="text-gray-500 font-medium">No posts found for this filter</p>
            </div>
          ) : (
            filteredPosts.slice(0, 20).map((post) => {
              const venue = venues.find(v => v.id === post.venueId);
              const postUser = users.find(u => u.id === post.userId);
              const reports = getPostReports(post.id);
              const primaryReport = reports[0];
              const isReported = post.isReported || reports.length > 0;
              const isPending = post.status === 'Pending';

              return (
                <div
                  key={post.id}
                  className={`bg-white dark:bg-surface-dark rounded-3xl border shadow-sm overflow-hidden relative ${
                    isReported ? 'border-red-100 dark:border-red-900' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Header */}
                  <div className={`px-6 py-3 border-b flex items-center justify-between ${
                    isReported ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                      isReported ? 'text-red-700' : 'text-gray-600'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {isReported ? 'report' : isPending ? 'hourglass_top' : 'check_circle'}
                      </span>
                      {isReported
                        ? `Reported: ${primaryReport?.reason || 'Inappropriate Content'}`
                        : isPending
                        ? 'Status: Pending Approval'
                        : `Status: ${post.status}`}
                    </div>
                    <span className="text-gray-300 text-[10px] font-bold font-mono">#{post.id.substring(0, 8).toUpperCase()}</span>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/20 text-primary-content flex items-center justify-center font-black border border-gray-200 dark:border-gray-700">
                          {postUser?.name?.[0]?.toUpperCase() || post.userName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 flex items-center gap-1">
                            {postUser?.name || post.userName || 'Unknown User'}
                            {postUser?.role === 'super_admin' && (
                              <span className="material-symbols-outlined text-primary text-[14px] filled">verified</span>
                            )}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {post.createdAt
                              ? getRelativeTime(post.createdAt)
                              : 'Unknown time'} • {post.type}
                            {venue && ` • ${venue.name}`}
                          </p>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>

                    {/* Match Result (if type is Match) */}
                    {post.type === 'Match' && post.matchResult && (
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-6">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="size-14 rounded-full bg-white shadow-sm flex items-center justify-center text-red-600 font-black text-xl border border-gray-50">
                              {post.matchResult.teamA.name[0]?.toUpperCase() || 'A'}
                            </div>
                            <p className="font-black text-gray-800 text-[10px] uppercase tracking-widest">
                              {post.matchResult.teamA.name}
                            </p>
                            <p className="text-lg font-black text-gray-900">{post.matchResult.teamA.score}</p>
                          </div>
                          <div className="flex flex-col items-center justify-center px-4">
                            <div className="h-8 w-8 rounded-full bg-sidebar-dark text-white flex items-center justify-center font-black text-[10px] shadow-md border-4 border-white">
                              VS
                            </div>
                            <div className="mt-2 px-3 py-0.5 bg-gray-200 rounded text-[9px] font-black text-gray-500 uppercase tracking-widest">
                              {post.matchResult.status}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="size-14 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-600 font-black text-xl border border-gray-50">
                              {post.matchResult.teamB.name[0]?.toUpperCase() || 'B'}
                            </div>
                            <p className="font-black text-gray-800 text-[10px] uppercase tracking-widest">
                              {post.matchResult.teamB.name}
                            </p>
                            <p className="text-lg font-black text-gray-900">{post.matchResult.teamB.score}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Post Content */}
                    <p className={`text-gray-700 text-sm leading-relaxed p-4 rounded-2xl border font-medium ${
                      isReported
                        ? 'bg-red-50/50 border-red-100/50'
                        : 'bg-gray-50 border-gray-100'
                    }`}>
                      {post.content}
                    </p>

                    {/* Report Info */}
                    {isReported && primaryReport && (
                      <div className="mt-4 p-4 bg-red-50/30 border border-red-100 rounded-xl">
                        <p className="text-xs font-bold text-red-700 mb-2">Report Details:</p>
                        <p className="text-xs text-gray-600">
                          <span className="font-bold">Reason:</span> {primaryReport.reason}
                        </p>
                        {primaryReport.description && (
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="font-bold">Description:</span> {primaryReport.description}
                          </p>
                        )}
                        {primaryReport.reporterName && (
                          <p className="text-xs text-gray-500 mt-1">
                            Reported by: {primaryReport.reporterName}
                          </p>
                        )}
                        {reports.length > 1 && (
                          <p className="text-xs text-red-600 font-bold mt-2">
                            +{reports.length - 1} more report(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={`px-6 py-4 border-t flex items-center gap-3 ${
                    isReported ? 'bg-red-50/30 border-red-100' : 'bg-gray-50 border-gray-100'
                  }`}>
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleRejectPost(post.id)}
                          disabled={processing === post.id}
                          className="flex-1 py-2.5 bg-white border border-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleApprovePost(post.id)}
                          disabled={processing === post.id}
                          className="flex-1 py-2.5 bg-primary text-primary-content rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
                        >
                          {processing === post.id ? 'Processing...' : 'Approve'}
                        </button>
                      </>
                    ) : isReported ? (
                      <>
                        <button
                          onClick={() => handleBanUser(post.userId, post.id)}
                          disabled={processing === `ban-${post.userId}`}
                          className="flex-1 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
                        >
                          {processing === `ban-${post.userId}` ? 'Banning...' : 'Ban User'}
                        </button>
                        <button
                          onClick={() => handleRemovePost(post.id)}
                          disabled={processing === post.id}
                          className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                        >
                          {processing === post.id ? 'Removing...' : 'Remove'}
                        </button>
                        <button
                          onClick={() => primaryReport && handleDismissReport(primaryReport.id)}
                          disabled={processing === `dismiss-${primaryReport?.id}`}
                          className="flex-1 bg-primary text-primary-content px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-lg shadow-green-200 disabled:opacity-50"
                        >
                          {processing === `dismiss-${primaryReport?.id}` ? 'Dismissing...' : 'Ignore'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRemovePost(post.id)}
                        disabled={processing === post.id}
                        className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                      >
                        {processing === post.id ? 'Removing...' : 'Remove Post'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* History Log Modal */}
      <HistoryLogModal
        isOpen={showHistoryLog}
        onClose={() => setShowHistoryLog(false)}
        reports={allReports}
        posts={allPosts}
        users={users}
      />
      {confirmDialog}
    </div>
  );
};

export default Moderation;
