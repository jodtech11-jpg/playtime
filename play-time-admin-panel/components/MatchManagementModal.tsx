import React, { useState, useEffect } from 'react';
import { Tournament, TournamentMatch, TournamentTeam } from '../types';
import { tournamentsCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useCourts } from '../hooks/useCourts';
import { formatDate } from '../utils/dateUtils';

interface MatchManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  match?: TournamentMatch | null;
  onSuccess?: () => void;
}

const MatchManagementModal: React.FC<MatchManagementModalProps> = ({
  isOpen,
  onClose,
  tournament,
  match,
  onSuccess
}) => {
  const { courts } = useCourts({ venueId: tournament?.venueId, realtime: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [round, setRound] = useState('');
  const [matchNumber, setMatchNumber] = useState<string>('');
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [courtId, setCourtId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [status, setStatus] = useState<TournamentMatch['status']>('Scheduled');
  const [scoreA, setScoreA] = useState<string>('');
  const [scoreB, setScoreB] = useState<string>('');

  useEffect(() => {
    if (match && tournament) {
      setRound(match.round);
      setMatchNumber(match.matchNumber.toString());
      setTeamAId(match.teamAId);
      setTeamBId(match.teamBId);
      setCourtId(match.courtId || '');
      setScheduledTime(
        match.scheduledTime?.toDate
          ? match.scheduledTime.toDate().toISOString().slice(0, 16)
          : ''
      );
      setStatus(match.status);
      setScoreA(match.score?.teamA.toString() || '');
      setScoreB(match.score?.teamB.toString() || '');
    } else {
      resetForm();
    }
    setError(null);
  }, [match, tournament, isOpen]);

  const resetForm = () => {
    setRound('');
    setMatchNumber('');
    setTeamAId('');
    setTeamBId('');
    setCourtId('');
    setScheduledTime('');
    setStatus('Scheduled');
    setScoreA('');
    setScoreB('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    setError(null);
    setLoading(true);

    try {
      if (!round.trim()) {
        throw new Error('Round is required');
      }

      if (!matchNumber || parseInt(matchNumber) <= 0) {
        throw new Error('Valid match number is required');
      }

      if (!teamAId || !teamBId) {
        throw new Error('Both teams must be selected');
      }

      if (teamAId === teamBId) {
        throw new Error('Teams must be different');
      }

      const teamA = tournament.teams?.find(t => t.id === teamAId);
      const teamB = tournament.teams?.find(t => t.id === teamBId);

      if (!teamA || !teamB) {
        throw new Error('Selected teams not found');
      }

      const matchData: Omit<TournamentMatch, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round: round.trim(),
        matchNumber: parseInt(matchNumber),
        teamAId,
        teamAName: teamA.name,
        teamBId,
        teamBName: teamB.name,
        courtId: courtId || undefined,
        courtName: courtId ? courts.find(c => c.id === courtId)?.name : undefined,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
        status,
        score: (scoreA && scoreB) ? {
          teamA: parseInt(scoreA),
          teamB: parseInt(scoreB)
        } : undefined,
        winnerId: (scoreA && scoreB && parseInt(scoreA) !== parseInt(scoreB))
          ? (parseInt(scoreA) > parseInt(scoreB) ? teamAId : teamBId)
          : undefined,
        winnerName: (scoreA && scoreB && parseInt(scoreA) !== parseInt(scoreB))
          ? (parseInt(scoreA) > parseInt(scoreB) ? teamA.name : teamB.name)
          : undefined
      };

      const matches = tournament.matches || [];
      let updatedMatches: TournamentMatch[];

      if (match) {
        updatedMatches = matches.map(m =>
          m.id === match.id
            ? { ...match, ...matchData, updatedAt: serverTimestamp() }
            : m
        );
      } else {
        const newMatch: TournamentMatch = {
          id: `match_${Date.now()}`,
          ...matchData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        updatedMatches = [...matches, newMatch];
      }

      await tournamentsCollection.update(tournament.id, {
        matches: updatedMatches,
        updatedAt: serverTimestamp()
      });

      onSuccess?.();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save match');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tournament || !match) return;
    if (!confirm(`Are you sure you want to delete this match?`)) return;

    try {
      setLoading(true);
      const matches = (tournament.matches || []).filter(m => m.id !== match.id);
      await tournamentsCollection.update(tournament.id, {
        matches,
        updatedAt: serverTimestamp()
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete match');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !tournament) return null;

  const teams = tournament.teams || [];
  const approvedTeams = teams.filter(t => t.status === 'Approved' || t.status === 'Paid');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">
              {match ? 'Edit Match' : 'Create Match'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{tournament.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Round *
              </label>
              <input
                type="text"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Round 1, Quarterfinals, Semifinals, Finals"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Match Number *
              </label>
              <input
                type="number"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Team A *
              </label>
              <select
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select Team A</option>
                {approvedTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} {team.division ? `(${team.division})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Team B *
              </label>
              <select
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select Team B</option>
                {approvedTeams
                  .filter(team => team.id !== teamAId)
                  .map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.division ? `(${team.division})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Court (Optional)
              </label>
              <select
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No Court Assigned</option>
                {courts.map(court => (
                  <option key={court.id} value={court.id}>
                    {court.name} ({court.sport})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Scheduled Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TournamentMatch['status'])}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Live">Live</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Score Entry */}
          {(status === 'Live' || status === 'Completed') && (
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <h4 className="text-lg font-black text-gray-900">Score</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    {tournament.teams?.find(t => t.id === teamAId)?.name || 'Team A'} Score
                  </label>
                  <input
                    type="number"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    {tournament.teams?.find(t => t.id === teamBId)?.name || 'Team B'} Score
                  </label>
                  <input
                    type="number"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                  />
                </div>
              </div>
              {scoreA && scoreB && parseInt(scoreA) !== parseInt(scoreB) && (
                <div className="mt-4 p-4 bg-primary/10 rounded-xl">
                  <p className="text-sm font-bold text-primary">
                    Winner: {parseInt(scoreA) > parseInt(scoreB)
                      ? tournament.teams?.find(t => t.id === teamAId)?.name
                      : tournament.teams?.find(t => t.id === teamBId)?.name}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            {match && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all disabled:opacity-50"
              >
                Delete Match
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl font-black text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : match ? 'Update Match' : 'Create Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchManagementModal;

