import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournaments } from '../hooks/useTournaments';
import { useVenues } from '../hooks/useVenues';
import { useSports } from '../hooks/useSports';
import { Tournament, TournamentTeam, TournamentMatch } from '../types';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import TournamentFormModal from '../components/modals/TournamentFormModal';
import TeamRegistrationModal from '../components/modals/TeamRegistrationModal';
import MatchManagementModal from '../components/modals/MatchManagementModal';
import { useToast } from '../contexts/ToastContext';

const TournamentDetail: React.FC = () => {
  const { showInfo } = useToast();
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  const { tournaments, loading } = useTournaments({ realtime: true });
  const { venues } = useVenues({ realtime: true });
  const { sports } = useSports({ activeOnly: false, realtime: true });

  const tournament = useMemo(
    () => tournaments.find(t => t.id === tournamentId) ?? null,
    [tournaments, tournamentId]
  );

  const [activeTab, setActiveTab] = useState<'Overview' | 'Registration & Teams' | 'Schedule' | 'Brackets'>('Overview');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>('All');
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('All');

  const getSportName = (sportId: string) => {
    const sport = sports.find(s => s.id === sportId);
    return sport ? sport.name : sportId;
  };

  const getVenueName = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    return venue?.name || 'Unknown Venue';
  };

  const filteredTeams = useMemo(() => {
    if (!tournament) return [];
    const teams = tournament.teams || [];
    if (teamStatusFilter === 'All') return teams;
    return teams.filter(t => t.status === teamStatusFilter || t.paymentStatus === teamStatusFilter);
  }, [tournament, teamStatusFilter]);

  const filteredMatches = useMemo(() => {
    if (!tournament) return [];
    const matches = tournament.matches || [];
    if (matchStatusFilter === 'All') return matches;
    return matches.filter(m => m.status === matchStatusFilter);
  }, [tournament, matchStatusFilter]);

  const stats = useMemo(() => {
    if (!tournament) return { totalTeams: 0, pendingFees: 0, totalMatches: 0, totalRevenue: 0 };
    const teams = tournament.teams || [];
    const paidTeams = teams.filter(t => t.paymentStatus === 'Paid').length;
    const pendingTeams = teams.filter(t => t.paymentStatus === 'Pending').length;
    const matches = tournament.matches || [];
    return {
      totalTeams: teams.length,
      pendingFees: pendingTeams * (tournament.entryFee || 0),
      totalMatches: matches.length,
      totalRevenue: paidTeams * (tournament.entryFee || 0)
    };
  }, [tournament]);

  const handleGenerateReport = () => {
    if (!tournament) return;
    const venue = venues.find(v => v.id === tournament.venueId);
    const teams = tournament.teams || [];
    const matches = tournament.matches || [];
    const paidTeams = teams.filter(t => t.paymentStatus === 'Paid');
    const pendingTeams = teams.filter(t => t.paymentStatus === 'Pending');
    const totalRevenue = paidTeams.length * (tournament.entryFee || 0);
    const pendingFees = pendingTeams.length * (tournament.entryFee || 0);
    const completedMatches = matches.filter(m => m.status === 'Completed').length;
    const scheduledMatches = matches.filter(m => m.status === 'Scheduled').length;

    const startDate = tournament.startDate?.toDate ? tournament.startDate.toDate() : new Date(tournament.startDate);
    const endDate = tournament.endDate?.toDate ? tournament.endDate.toDate() : new Date(tournament.endDate);
    const regStartDate = tournament.registrationStartDate?.toDate ? tournament.registrationStartDate.toDate() : new Date(tournament.registrationStartDate);
    const regEndDate = tournament.registrationEndDate?.toDate ? tournament.registrationEndDate.toDate() : new Date(tournament.registrationEndDate);

    const csvRows = [
      ['TOURNAMENT REPORT'],
      [''],
      ['Tournament Details'],
      ['Name', tournament.name],
      ['Description', tournament.description || 'N/A'],
      ['Sport', tournament.sport],
      ['Venue', venue?.name || tournament.venueName || 'Unknown'],
      ['Status', tournament.status],
      ['Bracket Type', tournament.bracketType || 'N/A'],
      [''],
      ['Dates'],
      ['Start Date', formatDate(startDate)],
      ['End Date', formatDate(endDate)],
      ['Registration Start', formatDate(regStartDate)],
      ['Registration End', formatDate(regEndDate)],
      [''],
      ['Financial Information'],
      ['Entry Fee', formatCurrency(tournament.entryFee || 0)],
      ['Total Teams Registered', teams.length.toString()],
      ['Paid Teams', paidTeams.length.toString()],
      ['Pending Payments', pendingTeams.length.toString()],
      ['Total Revenue', formatCurrency(totalRevenue)],
      ['Pending Fees', formatCurrency(pendingFees)],
      [''],
      ['Prize Details'],
      ['First Place', tournament.prizeDetails?.first ? formatCurrency(tournament.prizeDetails.first) : 'N/A'],
      ['Second Place', tournament.prizeDetails?.second ? formatCurrency(tournament.prizeDetails.second) : 'N/A'],
      ['Third Place', tournament.prizeDetails?.third ? formatCurrency(tournament.prizeDetails.third) : 'N/A'],
      ['Prize Description', tournament.prizeDetails?.description || 'N/A'],
      [''],
      ['Match Information'],
      ['Total Matches', matches.length.toString()],
      ['Scheduled Matches', scheduledMatches.toString()],
      ['Completed Matches', completedMatches.toString()],
      [''],
      ['Team Details'],
      ['Team Name', 'Captain', 'Captain Email', 'Captain Phone', 'Members', 'Status', 'Payment Status', 'Division'],
      ...teams.map(team => [
        team.name,
        team.captainName || 'N/A',
        team.captainEmail || 'N/A',
        team.captainPhone || 'N/A',
        team.members.length.toString(),
        team.status,
        team.paymentStatus,
        team.division || 'N/A'
      ]),
      [''],
      ['Match Details'],
      ['Round', 'Match #', 'Team A', 'Team B', 'Court', 'Scheduled Time', 'Status', 'Score', 'Winner'],
      ...matches.map(match => {
        const scheduledTime = match.scheduledTime?.toDate ? formatDate(match.scheduledTime.toDate()) : 'N/A';
        const score = match.score ? `${match.score.teamA} - ${match.score.teamB}` : 'N/A';
        return [
          match.round,
          match.matchNumber.toString(),
          match.teamAName,
          match.teamBName,
          match.courtName || 'N/A',
          scheduledTime,
          match.status,
          score,
          match.winnerName || 'N/A'
        ];
      }),
      [''],
      ['Report Generated', new Date().toLocaleString()]
    ];

    const csvContent = csvRows.map(row =>
      Array.isArray(row) ? row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') : row
    ).join('\n');

    // UTF-8 BOM so Excel displays ₹ and other Unicode correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tournament-report-${tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading && tournaments.length === 0) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center h-full bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center h-full bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">emoji_events</span>
          <p className="text-xl font-black text-gray-900 dark:text-gray-100 mb-2">Tournament not found</p>
          <p className="text-gray-500 dark:text-gray-400 mb-6">The tournament may have been deleted or the link is invalid.</p>
          <button
            onClick={() => navigate('/tournaments')}
            className="px-6 py-3 bg-primary text-primary-content rounded-xl font-black hover:shadow-lg transition-all"
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    );
  }

  const statusColors = getStatusColor(tournament.status);
  const startDate = tournament.startDate?.toDate ? tournament.startDate.toDate() : new Date(tournament.startDate);
  const endDate = tournament.endDate?.toDate ? tournament.endDate.toDate() : new Date(tournament.endDate);
  const regStart = tournament.registrationStartDate?.toDate ? tournament.registrationStartDate.toDate() : new Date(tournament.registrationStartDate);
  const regEnd = tournament.registrationEndDate?.toDate ? tournament.registrationEndDate.toDate() : new Date(tournament.registrationEndDate);

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 h-full bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          <button onClick={() => navigate('/tournaments')} className="hover:text-primary transition-colors">
            Tournaments
          </button>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-gray-700 dark:text-gray-300 truncate max-w-xs">{tournament.name}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap justify-between items-end gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {tournament.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-2xl">
              {tournament.description || 'Manage teams, brackets, and schedules for this event.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/tournaments')}
              className="h-12 px-6 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span> Back
            </button>
            <button
              onClick={() => setIsFormModalOpen(true)}
              className="h-12 px-6 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span> Edit
            </button>
            <button
              onClick={handleGenerateReport}
              className="h-12 px-6 bg-primary text-primary-content text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
              title={`Download report for ${tournament.name}`}
            >
              <span className="material-symbols-outlined text-[20px]">print</span> Report
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Teams", val: stats.totalTeams.toString(), icon: "groups", color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Pending Fees", val: formatCurrency(stats.pendingFees), icon: "pending_actions", color: "text-orange-600", bg: "bg-orange-50", badge: stats.pendingFees > 0 ? "Action" : undefined },
            { label: "Matches Scheduled", val: stats.totalMatches.toString(), icon: "scoreboard", color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Total Revenue", val: formatCurrency(stats.totalRevenue), icon: "payments", color: "text-green-600", bg: "bg-green-50" },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className={`p-3 ${s.bg} ${s.color} rounded-xl shadow-sm`}>
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                {s.badge && (
                  <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full uppercase tracking-widest">{s.badge}</span>
                )}
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest">{s.label}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{s.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-10">
            {(['Overview', 'Registration & Teams', 'Schedule', 'Brackets'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab - Tournament Details */}
        {activeTab === 'Overview' && (
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                <div>
                  <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Basic Information</h3>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Sport</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{getSportName(tournament.sport)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Venue</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{getVenueName(tournament.venueId)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Status</dt>
                      <dd>
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
                          {tournament.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Bracket Type</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{tournament.bracketType || 'Single Elimination'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Entry Fee</dt>
                      <dd className="text-lg font-black text-primary">{formatCurrency(tournament.entryFee || 0)}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Dates</h3>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Start Date</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{formatDate(startDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">End Date</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{formatDate(endDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Registration Opens</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{formatDate(regStart)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">Registration Closes</dt>
                      <dd className="text-lg font-black text-gray-900 dark:text-gray-100">{formatDate(regEnd)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {(tournament.maxTeams || tournament.minTeamSize || tournament.maxTeamSize) && (
                <div>
                  <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Team Configuration</h3>
                  <div className="flex gap-6 flex-wrap">
                    {tournament.maxTeams && <div><span className="text-xs text-gray-500 dark:text-gray-400">Max Teams:</span> <span className="font-black text-gray-900 dark:text-gray-100">{tournament.maxTeams}</span></div>}
                    {tournament.minTeamSize && <div><span className="text-xs text-gray-500 dark:text-gray-400">Min Team Size:</span> <span className="font-black text-gray-900 dark:text-gray-100">{tournament.minTeamSize}</span></div>}
                    {tournament.maxTeamSize && <div><span className="text-xs text-gray-500 dark:text-gray-400">Max Team Size:</span> <span className="font-black text-gray-900 dark:text-gray-100">{tournament.maxTeamSize}</span></div>}
                  </div>
                </div>
              )}

              {tournament.prizeDetails && (tournament.prizeDetails.first || tournament.prizeDetails.second || tournament.prizeDetails.third || tournament.prizeDetails.description) && (
                <div>
                  <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Prize Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tournament.prizeDetails.first != null && (
                      <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">First Place</p>
                        <p className="text-xl font-black text-primary">{formatCurrency(tournament.prizeDetails.first)}</p>
                      </div>
                    )}
                    {tournament.prizeDetails.second != null && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Second Place</p>
                        <p className="text-xl font-black text-gray-900 dark:text-gray-100">{formatCurrency(tournament.prizeDetails.second)}</p>
                      </div>
                    )}
                    {tournament.prizeDetails.third != null && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Third Place</p>
                        <p className="text-xl font-black text-gray-900 dark:text-gray-100">{formatCurrency(tournament.prizeDetails.third)}</p>
                      </div>
                    )}
                  </div>
                  {tournament.prizeDetails.description && (
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{tournament.prizeDetails.description}</p>
                  )}
                </div>
              )}

              {tournament.description && (
                <div>
                  <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Description</h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{tournament.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Registration & Teams Tab - reuse from Tournaments */}
        {activeTab === 'Registration & Teams' && (
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30 dark:bg-gray-800/30">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Team registration for <strong className="text-gray-900 dark:text-gray-100">{tournament.name}</strong></p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {filteredTeams.length} team(s) registered{tournament.maxTeams ? ` / ${tournament.maxTeams} max` : ''}
                </p>
              </div>
              <div className="flex gap-3">
                <select
                  value={teamStatusFilter}
                  onChange={(e) => setTeamStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
                <button
                  onClick={() => { setEditingTeam(null); setShowTeamModal(true); }}
                  disabled={tournament.maxTeams != null && (tournament.teams?.length || 0) >= tournament.maxTeams}
                  className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">add</span> Register Team
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredTeams.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">groups</span>
                  <p className="text-sm font-medium">No teams registered yet</p>
                  <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }} className="mt-4 px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:shadow-lg transition-all">
                    Register First Team
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4">Team Name</th>
                      <th className="px-6 py-4">Captain</th>
                      <th className="px-6 py-4">Members</th>
                      <th className="px-6 py-4">Division</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Payment</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4"><p className="font-black text-gray-900 dark:text-gray-100">{team.name}</p></td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{team.captainName || 'N/A'}</p>
                            {team.captainEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{team.captainEmail}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="font-bold text-gray-700 dark:text-gray-300">{team.members.length} member(s)</span></td>
                        <td className="px-6 py-4"><span className="text-gray-600 dark:text-gray-400">{team.division || 'N/A'}</span></td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            team.status === 'Approved' || team.status === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                            team.status === 'Rejected' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                            'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          }`}>{team.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            team.paymentStatus === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                            team.paymentStatus === 'Refunded' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                            'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          }`}>{team.paymentStatus}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => { setEditingTeam(team); setShowTeamModal(true); }} className="text-primary hover:text-primary-hover transition-colors" title="Edit Team">
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'Schedule' && (
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30 dark:bg-gray-800/30">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Match scheduling for <strong className="text-gray-900 dark:text-gray-100">{tournament.name}</strong></p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{filteredMatches.length} match(es) scheduled</p>
              </div>
              <div className="flex gap-3">
                <select
                  value={matchStatusFilter}
                  onChange={(e) => setMatchStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                >
                  <option value="All">All Status</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Live">Live</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <button onClick={() => { setEditingMatch(null); setShowMatchModal(true); }} className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">add</span> Create Match
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredMatches.length === 0 ? (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">event</span>
                  <p className="text-sm font-medium">No matches scheduled yet</p>
                  <button onClick={() => { setEditingMatch(null); setShowMatchModal(true); }} className="mt-4 px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:shadow-lg transition-all">
                    Create First Match
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4">Round</th>
                      <th className="px-6 py-4">Match #</th>
                      <th className="px-6 py-4">Team A</th>
                      <th className="px-6 py-4">Team B</th>
                      <th className="px-6 py-4">Court</th>
                      <th className="px-6 py-4">Scheduled Time</th>
                      <th className="px-6 py-4">Score</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                    {filteredMatches.sort((a, b) => (a.round !== b.round ? a.round.localeCompare(b.round) : a.matchNumber - b.matchNumber)).map((match) => {
                      const scheduledTime = match.scheduledTime?.toDate ? match.scheduledTime.toDate() : match.scheduledTime ? new Date(match.scheduledTime) : null;
                      return (
                        <tr key={match.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4"><span className="font-bold text-gray-900 dark:text-gray-100">{match.round}</span></td>
                          <td className="px-6 py-4"><span className="font-bold text-gray-700 dark:text-gray-300">#{match.matchNumber}</span></td>
                          <td className="px-6 py-4"><p className="font-black text-gray-900 dark:text-gray-100">{match.teamAName}</p></td>
                          <td className="px-6 py-4"><p className="font-black text-gray-900 dark:text-gray-100">{match.teamBName}</p></td>
                          <td className="px-6 py-4"><span className="text-gray-600 dark:text-gray-400">{match.courtName || 'TBD'}</span></td>
                          <td className="px-6 py-4">
                            {scheduledTime ? (
                              <div>
                                <p className="font-bold text-gray-900 dark:text-gray-100">{formatDate(scheduledTime)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            ) : <span className="text-gray-400">Not scheduled</span>}
                          </td>
                          <td className="px-6 py-4">
                            {match.score ? <span className="font-black text-gray-900 dark:text-gray-100">{match.score.teamA} - {match.score.teamB}</span> : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              match.status === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                              match.status === 'Live' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                              match.status === 'Cancelled' ? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400' :
                              'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                            }`}>{match.status}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingMatch(match); setShowMatchModal(true); }} className="text-primary hover:text-primary-hover transition-colors" title="Edit Match">
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Brackets Tab */}
        {activeTab === 'Brackets' && (
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30 dark:bg-gray-800/30">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tournament brackets for <strong className="text-gray-900 dark:text-gray-100">{tournament.name}</strong></p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tournament.bracketType || 'Single Elimination'} format</p>
              </div>
              <button
                onClick={() =>
                  showInfo(
                    'Bracket generation is coming soon. Create matches manually in the Schedule tab for now.',
                    8000
                  )
                }
                className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">auto_awesome</span> Generate Brackets
              </button>
            </div>
            <div className="p-4 sm:p-8">
              {filteredMatches.length > 0 ? (
                <div className="space-y-6">
                  {['Finals', 'Semifinals', 'Quarterfinals', 'Round 1'].map((round) => {
                    const roundMatches = filteredMatches.filter(m => m.round === round);
                    if (roundMatches.length === 0) return null;
                    return (
                      <div key={round} className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                        <h4 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-4">{round}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roundMatches.map((match) => (
                            <div key={match.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Match #{match.matchNumber}</span>
                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                  match.status === 'Completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                  match.status === 'Live' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}>{match.status}</span>
                              </div>
                              <div className="space-y-2">
                                <div className={`p-2 rounded-lg ${match.winnerId === match.teamAId ? 'bg-primary/10 border-2 border-primary' : 'bg-white dark:bg-surface-dark'}`}>
                                  <p className="font-black text-sm text-gray-900 dark:text-gray-100">{match.teamAName}</p>
                                  {match.score && <p className="text-lg font-black text-primary mt-1">{match.score.teamA}</p>}
                                </div>
                                <div className="text-center text-gray-400 font-black">VS</div>
                                <div className={`p-2 rounded-lg ${match.winnerId === match.teamBId ? 'bg-primary/10 border-2 border-primary' : 'bg-white dark:bg-surface-dark'}`}>
                                  <p className="font-black text-sm text-gray-900 dark:text-gray-100">{match.teamBName}</p>
                                  {match.score && <p className="text-lg font-black text-primary mt-1">{match.score.teamB}</p>}
                                </div>
                              </div>
                              {match.winnerName && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Winner:</p>
                                  <p className="font-black text-primary">{match.winnerName}</p>
                                </div>
                              )}
                              <button onClick={() => { setEditingMatch(match); setShowMatchModal(true); }} className="mt-3 w-full px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-black hover:bg-primary/20 transition-all">
                                Update Score
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">tournament</span>
                  <p className="text-sm font-medium">No matches created yet</p>
                  <p className="text-xs mt-2">Create matches in the Schedule tab to see brackets</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <TournamentFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        tournament={tournament}
        onSuccess={() => setIsFormModalOpen(false)}
      />
      <TeamRegistrationModal
        isOpen={showTeamModal}
        onClose={() => { setShowTeamModal(false); setEditingTeam(null); }}
        tournament={tournament}
        team={editingTeam}
        onSuccess={() => { setShowTeamModal(false); setEditingTeam(null); }}
      />
      <MatchManagementModal
        isOpen={showMatchModal}
        onClose={() => { setShowMatchModal(false); setEditingMatch(null); }}
        tournament={tournament}
        match={editingMatch}
        onSuccess={() => { setShowMatchModal(false); setEditingMatch(null); }}
      />
    </div>
  );
};

export default TournamentDetail;
