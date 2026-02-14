import React, { useState } from 'react';
import { Poll } from '../types';
import { usePolls } from '../hooks/usePolls';
import { useAuth } from '../contexts/AuthContext';
import { pollsCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import PollFormModal from '../components/PollFormModal';
import { formatDate } from '../utils/dateUtils';

const Polls: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const { polls, loading } = usePolls({
    realtime: true,
    status: statusFilter !== 'All' ? statusFilter as Poll['status'] : undefined,
    sport: sportFilter !== 'All' ? sportFilter : undefined,
  });

  const filteredPolls = polls.filter(poll => {
    if (statusFilter !== 'All' && poll.status !== statusFilter) return false;
    if (sportFilter !== 'All' && poll.sport !== sportFilter) return false;
    return true;
  });

  const handleCreatePoll = () => {
    setSelectedPoll(null);
    setShowCreateModal(true);
  };

  const handleEditPoll = (poll: Poll) => {
    setSelectedPoll(poll);
    setShowCreateModal(true);
  };

  const handleSavePoll = async (pollData: Partial<Poll>) => {
    try {
      setProcessing('saving');

      if (selectedPoll) {
        await pollsCollection.update(selectedPoll.id, {
          ...pollData,
          updatedAt: serverTimestamp(),
        });
        showSuccess('Poll updated successfully');
      } else {
        await pollsCollection.create({
          ...pollData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess('Poll created successfully');
      }

      setShowCreateModal(false);
      setSelectedPoll(null);
    } catch (error: any) {
      console.error('Error saving poll:', error);
      showError('Failed to save poll: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll?')) {
      return;
    }

    try {
      setProcessing(pollId);
      await pollsCollection.delete(pollId);
      showSuccess('Poll deleted successfully');
    } catch (error: any) {
      console.error('Error deleting poll:', error);
      showError('Failed to delete poll: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateStatus = async (pollId: string, newStatus: Poll['status']) => {
    try {
      setProcessing(pollId);
      await pollsCollection.update(pollId, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      showSuccess('Status updated successfully');
    } catch (error: any) {
      console.error('Error updating status:', error);
      showError('Failed to update status: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const sports = ['All', 'Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball'];
  const statuses = ['All', 'Active', 'Closed'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Polls</h1>
          <p className="text-gray-400 text-sm">Manage community polls and face-offs</p>
        </div>
        <button
          onClick={handleCreatePoll}
          className="px-6 py-3 bg-primary text-background-dark rounded-xl hover:bg-primary/90 transition-colors font-black text-sm uppercase tracking-wider"
        >
          + New Poll
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-700 bg-surface-dark text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
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
          className="px-4 py-2 border border-gray-700 bg-surface-dark text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
      </div>

      {/* Polls List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="text-center py-12 bg-surface-dark rounded-2xl border border-gray-800">
          <p className="text-gray-400">No polls found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPolls.map((poll) => (
            <div
              key={poll.id}
              className="bg-surface-dark rounded-2xl p-6 border border-gray-800 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white mb-2">
                    {poll.question}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {poll.sport && (
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-black">
                        {poll.sport}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                      poll.status === 'Active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {poll.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {poll.options.map((option) => {
                  const percentage = poll.totalVotes > 0
                    ? ((option.votes / poll.totalVotes) * 100).toFixed(1)
                    : '0';
                  return (
                    <div key={option.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">{option.text}</span>
                        <span className="text-white font-black">{option.votes} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-gray-500 mb-4">
                <div>Total Votes: {poll.totalVotes}</div>
                {poll.startDate && (
                  <div>Start: {formatDate(poll.startDate.toDate())}</div>
                )}
                {poll.endDate && (
                  <div>End: {formatDate(poll.endDate.toDate())}</div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPoll(poll)}
                  className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-sm font-black uppercase tracking-wider"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePoll(poll.id)}
                  disabled={processing === poll.id}
                  className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {processing === poll.id ? '...' : 'Delete'}
                </button>
              </div>

              {/* Quick Status Update */}
              {poll.status === 'Active' && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => handleUpdateStatus(poll.id, 'Closed')}
                    className="w-full px-3 py-2 bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors text-xs font-black uppercase tracking-wider"
                  >
                    Close Poll
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <PollFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedPoll(null);
        }}
        onSave={handleSavePoll}
        poll={selectedPoll}
      />
    </div>
  );
};

export default Polls;

