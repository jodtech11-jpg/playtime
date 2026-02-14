import React, { useState, useEffect } from 'react';
import { Tournament, TournamentTeam } from '../types';
import { tournamentsCollection } from '../services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { useUsers } from '../hooks/useUsers';
import { formatCurrency } from '../utils/formatUtils';

interface TeamRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  team?: TournamentTeam | null;
  onSuccess?: () => void;
}

const TeamRegistrationModal: React.FC<TeamRegistrationModalProps> = ({
  isOpen,
  onClose,
  tournament,
  team,
  onSuccess
}) => {
  const { users } = useUsers({ limit: 100 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('');
  const [captainId, setCaptainId] = useState('');
  const [members, setMembers] = useState<Array<{ userId?: string; name: string; email?: string; phone?: string }>>([{ name: '' }]);
  const [division, setDivision] = useState('');
  const [status, setStatus] = useState<TournamentTeam['status']>('Pending');
  const [paymentStatus, setPaymentStatus] = useState<TournamentTeam['paymentStatus']>('Pending');

  useEffect(() => {
    if (team && tournament) {
      setTeamName(team.name);
      setCaptainId(team.captainId);
      setMembers(team.members.length > 0 ? team.members : [{ name: '' }]);
      setDivision(team.division || '');
      setStatus(team.status);
      setPaymentStatus(team.paymentStatus);
    } else {
      resetForm();
    }
    setError(null);
  }, [team, tournament, isOpen]);

  const resetForm = () => {
    setTeamName('');
    setCaptainId('');
    setMembers([{ name: '' }]);
    setDivision('');
    setStatus('Pending');
    setPaymentStatus('Pending');
  };

  const addMember = () => {
    setMembers([...members, { name: '' }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: string, value: string) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;

    setError(null);
    setLoading(true);

    try {
      if (!teamName.trim()) {
        throw new Error('Team name is required');
      }

      if (!captainId) {
        throw new Error('Please select a team captain');
      }

      const validMembers = members.filter(m => m.name.trim());
      if (validMembers.length < (tournament.minTeamSize || 1)) {
        throw new Error(`Team must have at least ${tournament.minTeamSize || 1} member(s)`);
      }

      if (tournament.maxTeamSize && validMembers.length > tournament.maxTeamSize) {
        throw new Error(`Team cannot have more than ${tournament.maxTeamSize} member(s)`);
      }

      const captain = users.find(u => u.id === captainId);
      const teamData: Omit<TournamentTeam, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        name: teamName.trim(),
        captainId,
        captainName: captain?.name,
        captainEmail: captain?.email,
        captainPhone: captain?.phone,
        members: validMembers,
        division: division.trim() || undefined,
        status,
        paymentStatus,
        paymentDate: paymentStatus === 'Paid' ? serverTimestamp() : undefined
      };

      const teams = tournament.teams || [];
      let updatedTeams: TournamentTeam[];

      if (team) {
        // Update existing team
        updatedTeams = teams.map(t => 
          t.id === team.id 
            ? { ...team, ...teamData, updatedAt: serverTimestamp() }
            : t
        );
      } else {
        // Add new team
        const newTeam: TournamentTeam = {
          id: `team_${Date.now()}`,
          ...teamData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        updatedTeams = [...teams, newTeam];
      }

      await tournamentsCollection.update(tournament.id, {
        teams: updatedTeams,
        updatedAt: serverTimestamp()
      });

      onSuccess?.();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tournament || !team) return;
    if (!confirm(`Are you sure you want to delete team "${team.name}"?`)) return;

    try {
      setLoading(true);
      const teams = (tournament.teams || []).filter(t => t.id !== team.id);
      await tournamentsCollection.update(tournament.id, {
        teams,
        updatedAt: serverTimestamp()
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete team');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !tournament) return null;

  const captain = users.find(u => u.id === captainId);
  const paidTeams = (tournament.teams || []).filter(t => t.paymentStatus === 'Paid').length;
  const totalTeams = (tournament.teams || []).length;
  const canAddTeam = !tournament.maxTeams || totalTeams < tournament.maxTeams;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-2xl font-black text-gray-900">
              {team ? 'Edit Team' : 'Register Team'}
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

        {!canAddTeam && !team && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
            Maximum number of teams ({tournament.maxTeams}) has been reached.
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Team Name *
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Team Alpha, Champions United"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Team Captain *
              </label>
              <select
                value={captainId}
                onChange={(e) => setCaptainId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Select Captain</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.email ? `(${user.email})` : ''}
                  </option>
                ))}
              </select>
              {captain && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl text-sm">
                  <p><strong>Name:</strong> {captain.name}</p>
                  {captain.email && <p><strong>Email:</strong> {captain.email}</p>}
                  {captain.phone && <p><strong>Phone:</strong> {captain.phone}</p>}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Division (Optional)
              </label>
              <input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Div A, Div B, Open"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Team Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TournamentTeam['status'])}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as TournamentTeam['paymentStatus'])}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Team Members */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Team Members * (Min: {tournament.minTeamSize || 1}, Max: {tournament.maxTeamSize || 'No limit'})
              </label>
              <button
                type="button"
                onClick={addMember}
                className="text-primary hover:text-primary-hover text-sm font-black flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Member
              </button>
            </div>
            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={index} className="flex gap-3 items-start p-4 border border-gray-200 rounded-xl">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Member Name *"
                      required
                    />
                    <input
                      type="email"
                      value={member.email || ''}
                      onChange={(e) => updateMember(index, 'email', e.target.value)}
                      className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Email (Optional)"
                    />
                    <input
                      type="tel"
                      value={member.phone || ''}
                      onChange={(e) => updateMember(index, 'phone', e.target.value)}
                      className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Phone (Optional)"
                    />
                  </div>
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-700">Entry Fee</p>
                <p className="text-2xl font-black text-primary mt-1">{formatCurrency(tournament.entryFee || 0)}</p>
              </div>
              {paymentStatus === 'Paid' && (
                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-black uppercase tracking-widest">
                  Paid
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            {team && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all disabled:opacity-50"
              >
                Delete Team
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
              disabled={loading || (!canAddTeam && !team)}
              className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : team ? 'Update Team' : 'Register Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamRegistrationModal;

