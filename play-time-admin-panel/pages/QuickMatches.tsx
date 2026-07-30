import React, { useState } from 'react';
import { QuickMatch } from '../types';
import { useQuickMatches } from '../hooks/useQuickMatches';
import { useAuth } from '../contexts/AuthContext';
import { quickMatchesCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useSports } from '../hooks/useSports';
import { withVendorId } from '../utils/vendorScope';
import QuickMatchFormModal from '../components/modals/QuickMatchFormModal';
import { formatDate, formatTime } from '../utils/dateUtils';
import { resolveSportName } from '../utils/formatUtils';
import { getFirebaseErrorMessage } from '../utils/errorUtils';
import FeatureStatusPanel from '../components/shared/FeatureStatusPanel';

const QuickMatches: React.FC = () => {
  const { user, isVenueManager } = useAuth();
  const { showSuccess, showError } = useToast();
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<QuickMatch | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const { sports: sportsCatalog } = useSports({ activeOnly: true, realtime: false });

  const { matches, loading, error } = useQuickMatches({
    realtime: true,
    status: statusFilter !== 'All' ? statusFilter as QuickMatch['status'] : undefined,
    sport: sportFilter !== 'All' ? sportFilter : undefined,
  });

  const filteredMatches = matches.filter(match => {
    if (statusFilter !== 'All' && match.status !== statusFilter) return false;
    if (sportFilter !== 'All' && match.sport !== sportFilter) return false;
    return true;
  });

  const handleCreateMatch = () => {
    setSelectedMatch(null);
    setShowCreateModal(true);
  };

  const handleEditMatch = (match: QuickMatch) => {
    setSelectedMatch(match);
    setShowCreateModal(true);
  };

  const handleSaveMatch = async (matchData: Partial<QuickMatch>) => {
    try {
      setProcessing('saving');

      if (selectedMatch) {
        await quickMatchesCollection.update(selectedMatch.id, {
          ...matchData,
          updatedAt: serverTimestamp(),
        });
        showSuccess('Quick match updated successfully');
      } else {
        await quickMatchesCollection.create(
          withVendorId(
            {
              ...matchData,
              createdBy: user?.id || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            isVenueManager ? user?.id : undefined
          )
        );
        showSuccess('Quick match created successfully');
      }

      setShowCreateModal(false);
      setSelectedMatch(null);
    } catch (error: any) {
      console.error('Error saving quick match:', error);
      showError('Failed to save quick match: ' + getFirebaseErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    openConfirm({
      title: 'Delete quick match?',
      message: 'This removes the match from the admin panel and the mobile app.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setProcessing(matchId);
          try {
            await quickMatchesCollection.delete(matchId);
          } catch (deleteError) {
            // Fallback for legacy permission edge-cases: cancel so mobile hides it.
            console.warn('Hard delete failed, cancelling match instead:', deleteError);
            await quickMatchesCollection.update(matchId, {
              status: 'Cancelled',
              updatedAt: serverTimestamp(),
            });
            showSuccess('Quick match cancelled and hidden from the app');
            return;
          }
          showSuccess('Quick match deleted successfully');
        } catch (error: any) {
          console.error('Error deleting quick match:', error);
          showError('Failed to delete quick match: ' + getFirebaseErrorMessage(error));
        } finally {
          setProcessing(null);
        }
      },
    });
  };

  const handleUpdateStatus = async (matchId: string, newStatus: QuickMatch['status']) => {
    try {
      setProcessing(matchId);
      await quickMatchesCollection.update(matchId, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      showSuccess('Status updated successfully');
    } catch (error: any) {
      console.error('Error updating status:', error);
      showError('Failed to update status: ' + getFirebaseErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: QuickMatch['status']) => {
    switch (status) {
      case 'Open':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Full':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Started':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Completed':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'Cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const sports = ['All', ...sportsCatalog.map((s) => s.name)];
  const statuses = ['All', 'Open', 'Full', 'Started', 'Completed', 'Cancelled'];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Quick Matches</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Manage quick matches for players to join</p>
        </div>
        <button
          onClick={handleCreateMatch}
          className="px-6 py-3 bg-primary text-background-dark rounded-xl hover:bg-primary/90 transition-colors font-black text-sm uppercase tracking-wider"
        >
          + New Match
        </button>
      </div>

      <FeatureStatusPanel moduleKey="teamUp" compact />
      <FeatureStatusPanel moduleKey="joinMatch" compact />
      <FeatureStatusPanel moduleKey="matches" compact />

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-800">
          <p className="text-gray-400">No quick matches found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((match) => (
            <div
              key={match.id}
              className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-gray-200 dark:border-gray-800 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
                    {match.venueName || 'Unknown Venue'}
                  </h3>
                  <p className="text-sm text-gray-400">{resolveSportName(match.sport, sportsCatalog)}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-black border ${getStatusColor(match.status)}`}>
                  {match.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-slate-600 dark:text-gray-300">
                  <span className="text-gray-500 w-24">Date:</span>
                  <span>{match.date ? formatDate(match.date.toDate()) : 'N/A'}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600 dark:text-gray-300">
                  <span className="text-gray-500 w-24">Time:</span>
                  <span>{match.time}</span>
                </div>
                <div className="flex items-center text-sm text-slate-600 dark:text-gray-300">
                  <span className="text-gray-500 w-24">Players:</span>
                  <span>{match.currentPlayers || 0} / {match.maxPlayers}</span>
                </div>
                {match.courtName && (
                  <div className="flex items-center text-sm text-slate-600 dark:text-gray-300">
                    <span className="text-gray-500 w-24">Court:</span>
                    <span>{match.courtName}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditMatch(match)}
                  className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm font-black uppercase tracking-wider"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteMatch(match.id)}
                  disabled={processing === match.id}
                  className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {processing === match.id ? '...' : 'Delete'}
                </button>
              </div>

              {/* Quick Status Update */}
              {match.status === 'Open' && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                  <select
                    value={match.status}
                    onChange={(e) => handleUpdateStatus(match.id, e.target.value as QuickMatch['status'])}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Open">Open</option>
                    <option value="Full">Mark as Full</option>
                    <option value="Started">Mark as Started</option>
                    <option value="Cancelled">Cancel</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <QuickMatchFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedMatch(null);
        }}
        onSave={handleSaveMatch}
        match={selectedMatch}
      />
      {confirmDialog}
    </div>
  );
};

export default QuickMatches;

