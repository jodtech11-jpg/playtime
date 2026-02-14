import React, { useState } from 'react';
import { Leaderboard } from '../types';
import { useLeaderboards } from '../hooks/useLeaderboards';
import { useAuth } from '../contexts/AuthContext';
import { leaderboardsCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import LeaderboardFormModal from '../components/LeaderboardFormModal';

const Leaderboards: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<Leaderboard | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const { leaderboards, loading } = useLeaderboards({
    realtime: true,
    type: typeFilter !== 'All' ? typeFilter as Leaderboard['type'] : undefined,
    sport: sportFilter !== 'All' ? sportFilter : undefined,
  });

  const filteredLeaderboards = leaderboards.filter(lb => {
    if (typeFilter !== 'All' && lb.type !== typeFilter) return false;
    if (sportFilter !== 'All' && lb.sport !== sportFilter) return false;
    return true;
  });

  const handleCreateLeaderboard = () => {
    setSelectedLeaderboard(null);
    setShowCreateModal(true);
  };

  const handleEditLeaderboard = (leaderboard: Leaderboard) => {
    setSelectedLeaderboard(leaderboard);
    setShowCreateModal(true);
  };

  const handleSaveLeaderboard = async (leaderboardData: Partial<Leaderboard>) => {
    try {
      setProcessing('saving');

      if (selectedLeaderboard) {
        await leaderboardsCollection.update(selectedLeaderboard.id, {
          ...leaderboardData,
          updatedAt: serverTimestamp(),
        });
        showSuccess('Leaderboard updated successfully');
      } else {
        await leaderboardsCollection.create({
          ...leaderboardData,
          entries: [],
          updatedAt: serverTimestamp(),
        });
        showSuccess('Leaderboard created successfully');
      }

      setShowCreateModal(false);
      setSelectedLeaderboard(null);
    } catch (error: any) {
      console.error('Error saving leaderboard:', error);
      showError('Failed to save leaderboard: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteLeaderboard = async (leaderboardId: string) => {
    if (!confirm('Are you sure you want to delete this leaderboard?')) {
      return;
    }

    try {
      setProcessing(leaderboardId);
      await leaderboardsCollection.delete(leaderboardId);
      showSuccess('Leaderboard deleted successfully');
    } catch (error: any) {
      console.error('Error deleting leaderboard:', error);
      showError('Failed to delete leaderboard: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const sports = ['All', 'Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball'];
  const types = ['All', 'Global', 'Venue', 'Monthly', 'All-Time'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Leaderboards</h1>
          <p className="text-gray-400 text-sm">Manage community leaderboards</p>
        </div>
        <button
          onClick={handleCreateLeaderboard}
          className="px-6 py-3 bg-primary text-background-dark rounded-xl hover:bg-primary/90 transition-colors font-black text-sm uppercase tracking-wider"
        >
          + New Leaderboard
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-700 bg-surface-dark text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="px-4 py-2 border border-gray-700 bg-surface-dark text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboards List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredLeaderboards.length === 0 ? (
        <div className="text-center py-12 bg-surface-dark rounded-2xl border border-gray-800">
          <p className="text-gray-400">No leaderboards found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaderboards.map((leaderboard) => (
            <div
              key={leaderboard.id}
              className="bg-surface-dark rounded-2xl p-6 border border-gray-800 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-white mb-1">
                    {leaderboard.sport} - {leaderboard.type}
                  </h3>
                  {leaderboard.venueName && (
                    <p className="text-sm text-gray-400">{leaderboard.venueName}</p>
                  )}
                  {leaderboard.period && (
                    <p className="text-sm text-gray-400">{leaderboard.period}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total Entries:</span>
                  <span className="text-white font-black">{leaderboard.entries?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total Votes:</span>
                  <span className="text-white font-black">{leaderboard.totalVotes || 0}</span>
                </div>
              </div>

              {/* Top 3 Entries Preview */}
              {leaderboard.entries && leaderboard.entries.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Top 3</p>
                  {leaderboard.entries.slice(0, 3).map((entry, index) => (
                    <div key={entry.userId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-black">#{entry.rank}</span>
                        <span className="text-white">{entry.userName || 'Unknown'}</span>
                      </div>
                      <span className="text-primary font-black">{entry.score}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditLeaderboard(leaderboard)}
                  className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm font-black uppercase tracking-wider"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteLeaderboard(leaderboard.id)}
                  disabled={processing === leaderboard.id}
                  className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {processing === leaderboard.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <LeaderboardFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedLeaderboard(null);
        }}
        onSave={handleSaveLeaderboard}
        leaderboard={selectedLeaderboard}
      />
    </div>
  );
};

export default Leaderboards;

