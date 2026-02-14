import React, { useState, useMemo, useEffect } from 'react';
import { useTournaments } from '../hooks/useTournaments';
import { useVenues } from '../hooks/useVenues';
import { useSports } from '../hooks/useSports';
import { tournamentsCollection } from '../services/firebase';
import { Tournament, TournamentTeam, TournamentMatch } from '../types';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate, getRelativeTime } from '../utils/dateUtils';
import { serverTimestamp } from 'firebase/firestore';
import TournamentFormModal from '../components/TournamentFormModal';
import TeamRegistrationModal from '../components/TeamRegistrationModal';
import MatchManagementModal from '../components/MatchManagementModal';
import SportManagementModal from '../components/SportManagementModal';

const Tournaments: React.FC = () => {
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Tournament['status']>('All');
  const [venueFilter, setVenueFilter] = useState<string>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'Overview' | 'Registration & Teams' | 'Schedule' | 'Brackets'>('Overview');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>('All');
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('All');
  const [showSportModal, setShowSportModal] = useState(false);

  const { tournaments, loading } = useTournaments({ realtime: true });
  const { venues } = useVenues({ realtime: true });
  const { sports, loading: sportsLoading } = useSports({ activeOnly: false, realtime: true });

  // Filter tournaments
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(tournament => {
      const sportName = getSportName(tournament.sport);
      const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sportName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tournament.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || tournament.status === statusFilter;
      const matchesVenue = venueFilter === 'All' || tournament.venueId === venueFilter;
      const matchesSport = sportFilter === 'All' || 
        tournament.sport === sportFilter || 
        tournament.sportId === sportFilter ||
        sportName === sportFilter;
      return matchesSearch && matchesStatus && matchesVenue && matchesSport;
    });
  }, [tournaments, searchTerm, statusFilter, venueFilter, sportFilter, sports]);

  // Filter teams
  const filteredTeams = useMemo(() => {
    if (!selectedTournament) return [];
    const teams = selectedTournament.teams || [];
    if (teamStatusFilter === 'All') return teams;
    return teams.filter(t => t.status === teamStatusFilter || t.paymentStatus === teamStatusFilter);
  }, [selectedTournament, teamStatusFilter]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    if (!selectedTournament) return [];
    const matches = selectedTournament.matches || [];
    if (matchStatusFilter === 'All') return matches;
    return matches.filter(m => m.status === matchStatusFilter);
  }, [selectedTournament, matchStatusFilter]);

  // Calculate statistics for selected tournament
  const stats = useMemo(() => {
    if (!selectedTournament) {
      // Overall stats
      const totalTeams = tournaments.reduce((sum, t) => sum + (t.teams?.length || 0), 0);
      const pendingFees = tournaments.reduce((sum, t) => {
        const unpaid = t.teams?.filter(team => team.paymentStatus === 'Pending').length || 0;
        return sum + (unpaid * (t.entryFee || 0));
      }, 0);
      const totalMatches = tournaments.reduce((sum, t) => sum + (t.matches?.length || 0), 0);
      const totalRevenue = tournaments.reduce((sum, t) => {
        const paid = t.teams?.filter(team => team.paymentStatus === 'Paid').length || 0;
        return sum + (paid * (t.entryFee || 0));
      }, 0);

      return {
        totalTeams,
        pendingFees,
        totalMatches,
        totalRevenue
      };
    }

    // Selected tournament stats
    const teams = selectedTournament.teams || [];
    const paidTeams = teams.filter(t => t.paymentStatus === 'Paid').length;
    const pendingTeams = teams.filter(t => t.paymentStatus === 'Pending').length;
    const matches = selectedTournament.matches || [];

    return {
      totalTeams: teams.length,
      pendingFees: pendingTeams * (selectedTournament.entryFee || 0),
      totalMatches: matches.length,
      totalRevenue: paidTeams * (selectedTournament.entryFee || 0)
    };
  }, [selectedTournament, tournaments]);

  // Get venue name
  const getVenueName = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    return venue?.name || 'Unknown Venue';
  };

  // Get sport name by ID
  const getSportName = (sportId: string): string => {
    const sport = sports.find(s => s.id === sportId);
    return sport ? sport.name : sportId; // Fallback to ID if sport not found
  };

  // Handle delete
  const handleDelete = async (tournament: Tournament) => {
    if (!window.confirm(`Are you sure you want to delete "${tournament.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await tournamentsCollection.delete(tournament.id);
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament: ' + error.message);
    }
  };

  // Handle edit
  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setIsFormModalOpen(true);
  };

  // Handle create
  const handleCreate = () => {
    setEditingTournament(null);
    setIsFormModalOpen(true);
  };

  // Handle generate report
  const handleGenerateReport = () => {
    if (selectedTournament) {
      // Generate report for selected tournament
      generateTournamentReport(selectedTournament);
    } else {
      // Generate report for all tournaments
      generateAllTournamentsReport();
    }
  };

  const generateTournamentReport = (tournament: Tournament) => {
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tournament-report-${tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAllTournamentsReport = () => {
    const csvRows = [
      ['ALL TOURNAMENTS REPORT'],
      [''],
      ['Report Generated', new Date().toLocaleString()],
      [''],
      ['Tournament Summary'],
      ['Name', 'Sport', 'Venue', 'Start Date', 'End Date', 'Status', 'Teams', 'Matches', 'Revenue', 'Pending Fees', 'Entry Fee'],
      ...tournaments.map(t => {
        const venue = venues.find(v => v.id === t.venueId);
        const teams = t.teams || [];
        const matches = t.matches || [];
        const paidTeams = teams.filter(team => team.paymentStatus === 'Paid');
        const pendingTeams = teams.filter(team => team.paymentStatus === 'Pending');
        const revenue = paidTeams.length * (t.entryFee || 0);
        const pendingFees = pendingTeams.length * (t.entryFee || 0);
        const startDate = t.startDate?.toDate ? formatDate(t.startDate.toDate()) : 'N/A';
        const endDate = t.endDate?.toDate ? formatDate(t.endDate.toDate()) : 'N/A';

        return [
          t.name,
          t.sport,
          venue?.name || t.venueName || 'Unknown',
          startDate,
          endDate,
          t.status,
          teams.length.toString(),
          matches.length.toString(),
          formatCurrency(revenue),
          formatCurrency(pendingFees),
          formatCurrency(t.entryFee || 0)
        ];
      }),
      [''],
      ['Summary Statistics'],
      ['Total Tournaments', tournaments.length.toString()],
      ['Total Teams', tournaments.reduce((sum, t) => sum + (t.teams?.length || 0), 0).toString()],
      ['Total Matches', tournaments.reduce((sum, t) => sum + (t.matches?.length || 0), 0).toString()],
      ['Total Revenue', formatCurrency(tournaments.reduce((sum, t) => {
        const paid = t.teams?.filter(team => team.paymentStatus === 'Paid').length || 0;
        return sum + (paid * (t.entryFee || 0));
      }, 0))],
      ['Total Pending Fees', formatCurrency(tournaments.reduce((sum, t) => {
        const pending = t.teams?.filter(team => team.paymentStatus === 'Pending').length || 0;
        return sum + (pending * (t.entryFee || 0));
      }, 0))]
    ];

    const csvContent = csvRows.map(row => 
      Array.isArray(row) ? row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') : row
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all-tournaments-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Register "New Entry" handler for Header button
  useEffect(() => {
    setNewEntryHandler(handleCreate);
    return () => {
      unsetNewEntryHandler();
    };
  }, [setNewEntryHandler, unsetNewEntryHandler]);

  // Auto-select first tournament if none selected
  React.useEffect(() => {
    if (!selectedTournament && filteredTournaments.length > 0) {
      setSelectedTournament(filteredTournaments[0]);
    }
  }, [filteredTournaments]);

  if (loading && tournaments.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-500">Loading tournaments...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 h-full bg-background-light">
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        <div className="flex flex-wrap justify-between items-end gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              {selectedTournament ? selectedTournament.name : 'Tournaments'}
            </h1>
            <p className="text-gray-500 font-medium max-w-2xl">
              {selectedTournament
                ? selectedTournament.description || 'Manage teams, brackets, and schedules for this event.'
                : 'Manage all tournaments, teams, brackets, and schedules.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateReport}
              className="h-12 px-6 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all flex items-center gap-2"
              title={selectedTournament ? `Generate report for ${selectedTournament.name}` : 'Generate report for all tournaments'}
            >
              <span className="material-symbols-outlined text-[20px]">print</span> Report
            </button>
            <button
              onClick={handleCreate}
              className="h-12 px-6 bg-primary text-primary-content text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add</span> New Tournament
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { 
              label: "Total Teams", 
              val: stats.totalTeams.toString(), 
              icon: "groups", 
              color: "text-blue-600", 
              bg: "bg-blue-50" 
            },
            { 
              label: "Pending Fees", 
              val: formatCurrency(stats.pendingFees), 
              icon: "pending_actions", 
              color: "text-orange-600", 
              bg: "bg-orange-50", 
              badge: stats.pendingFees > 0 ? "Action" : undefined 
            },
            { 
              label: "Matches Scheduled", 
              val: stats.totalMatches.toString(), 
              icon: "scoreboard", 
              color: "text-purple-600", 
              bg: "bg-purple-50" 
            },
            { 
              label: "Total Revenue", 
              val: formatCurrency(stats.totalRevenue), 
              icon: "payments", 
              color: "text-green-600", 
              bg: "bg-green-50" 
            },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between h-40">
              <div className="flex justify-between items-start">
                <div className={`p-3 ${s.bg} ${s.color} rounded-xl shadow-sm`}>
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                {s.badge && (
                  <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase tracking-widest">
                    {s.badge}
                  </span>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{s.label}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{s.val}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-10">
            {(['Overview', 'Registration & Teams', 'Schedule', 'Brackets'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'Overview' && (
          <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-4 items-center bg-gray-50/30 dark:bg-gray-800/30">
              <div className="relative w-full sm:max-w-xs">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  search
                </span>
                <input
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl text-sm focus:ring-primary focus:border-primary"
                  placeholder="Search tournaments..."
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3 w-full sm:w-auto flex-wrap">
                <select
                  className="h-11 px-4 bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="All">Status: All</option>
                  <option value="Draft">Draft</option>
                  <option value="Open">Open</option>
                  <option value="Registration Closed">Registration Closed</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <select
                  className="h-11 px-4 bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                  value={venueFilter}
                  onChange={(e) => setVenueFilter(e.target.value)}
                >
                  <option value="All">Venue: All</option>
                  {venues.map(venue => (
                    <option key={venue.id} value={venue.id}>{venue.name}</option>
                  ))}
                </select>
                <select
                  className="h-11 px-4 bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                  value={sportFilter}
                  onChange={(e) => setSportFilter(e.target.value)}
                >
                  <option value="All">Sport: All</option>
                  {sports.filter(s => s.isActive).map(sport => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSportModal(true)}
                  className="px-3 py-2 text-primary hover:bg-primary/10 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                  title="Manage Sports"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  Manage Sports
                </button>
                <button className="size-11 flex items-center justify-center bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 dark:text-gray-500 hover:text-primary transition-all">
                  <span className="material-symbols-outlined">download</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Tournament Name</th>
                    <th className="px-6 py-4">Sport</th>
                    <th className="px-6 py-4">Venue</th>
                    <th className="px-6 py-4">Start Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredTournaments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        {searchTerm || statusFilter !== 'All' ? 'No tournaments found matching your filters.' : 'No tournaments yet. Create your first tournament!'}
                      </td>
                    </tr>
                  ) : (
                    filteredTournaments.map((tournament) => {
                      const statusColors = getStatusColor(tournament.status);
                      const startDate = tournament.startDate?.toDate
                        ? tournament.startDate.toDate()
                        : new Date(tournament.startDate);

                      return (
                        <tr
                          key={tournament.id}
                          className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${
                            selectedTournament?.id === tournament.id ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedTournament(tournament)}
                        >
                          <td className="px-6 py-5">
                            <div>
                              <p className="font-black text-gray-900 dark:text-gray-100 leading-none">{tournament.name}</p>
                              {tournament.description && (
                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{tournament.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-bold text-gray-700">{getSportName(tournament.sport)}</span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-bold text-gray-700">{getVenueName(tournament.venueId)}</span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-bold text-gray-700">{formatDate(startDate)}</span>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}
                            >
                              {tournament.status}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(tournament);
                                }}
                                className="text-gray-400 hover:text-primary transition-all"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(tournament);
                                }}
                                className="text-gray-400 hover:text-red-600 transition-all"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Registration & Teams' && selectedTournament && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm text-gray-600">
                  Team registration management for <strong>{selectedTournament.name}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredTeams.length} team(s) registered
                  {selectedTournament.maxTeams && ` / ${selectedTournament.maxTeams} max`}
                </p>
              </div>
              <div className="flex gap-3">
                <select
                  value={teamStatusFilter}
                  onChange={(e) => setTeamStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
                <button
                  onClick={() => {
                    setEditingTeam(null);
                    setShowTeamModal(true);
                  }}
                  disabled={selectedTournament.maxTeams && (selectedTournament.teams?.length || 0) >= selectedTournament.maxTeams}
                  className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Register Team
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredTeams.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">groups</span>
                  <p className="text-sm font-medium">No teams registered yet</p>
                  <button
                    onClick={() => {
                      setEditingTeam(null);
                      setShowTeamModal(true);
                    }}
                    className="mt-4 px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:shadow-lg transition-all"
                  >
                    Register First Team
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
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
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-black text-gray-900">{team.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-gray-900">{team.captainName || 'N/A'}</p>
                            {team.captainEmail && (
                              <p className="text-xs text-gray-500">{team.captainEmail}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-700">{team.members.length} member(s)</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-600">{team.division || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            team.status === 'Approved' || team.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                            team.status === 'Rejected' ? 'bg-red-50 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {team.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            team.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                            team.paymentStatus === 'Refunded' ? 'bg-red-50 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {team.paymentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setEditingTeam(team);
                              setShowTeamModal(true);
                            }}
                            className="text-primary hover:text-primary-hover transition-colors"
                            title="Edit Team"
                          >
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

        {activeTab === 'Schedule' && selectedTournament && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm text-gray-600">
                  Match scheduling for <strong>{selectedTournament.name}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredMatches.length} match(es) scheduled
                </p>
              </div>
              <div className="flex gap-3">
                <select
                  value={matchStatusFilter}
                  onChange={(e) => setMatchStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-primary"
                >
                  <option value="All">All Status</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Live">Live</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <button
                  onClick={() => {
                    setEditingMatch(null);
                    setShowMatchModal(true);
                  }}
                  className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Create Match
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredMatches.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">event</span>
                  <p className="text-sm font-medium">No matches scheduled yet</p>
                  <button
                    onClick={() => {
                      setEditingMatch(null);
                      setShowMatchModal(true);
                    }}
                    className="mt-4 px-4 py-2 bg-primary text-primary-content rounded-xl text-sm font-black hover:shadow-lg transition-all"
                  >
                    Create First Match
                  </button>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
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
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredMatches
                      .sort((a, b) => {
                        if (a.round !== b.round) return a.round.localeCompare(b.round);
                        return a.matchNumber - b.matchNumber;
                      })
                      .map((match) => {
                        const scheduledTime = match.scheduledTime?.toDate
                          ? match.scheduledTime.toDate()
                          : match.scheduledTime
                            ? new Date(match.scheduledTime)
                            : null;
                        return (
                          <tr key={match.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-gray-900">{match.round}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-gray-700">#{match.matchNumber}</span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-black text-gray-900">{match.teamAName}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-black text-gray-900">{match.teamBName}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-600">{match.courtName || 'TBD'}</span>
                            </td>
                            <td className="px-6 py-4">
                              {scheduledTime ? (
                                <div>
                                  <p className="font-bold text-gray-900">{formatDate(scheduledTime)}</p>
                                  <p className="text-xs text-gray-500">
                                    {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-gray-400">Not scheduled</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {match.score ? (
                                <span className="font-black text-gray-900">
                                  {match.score.teamA} - {match.score.teamB}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                match.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                match.status === 'Live' ? 'bg-red-50 text-red-700' :
                                match.status === 'Cancelled' ? 'bg-gray-50 text-gray-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {match.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setEditingMatch(match);
                                  setShowMatchModal(true);
                                }}
                                className="text-primary hover:text-primary-hover transition-colors"
                                title="Edit Match"
                              >
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

        {activeTab === 'Brackets' && selectedTournament && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm text-gray-600">
                  Tournament brackets for <strong>{selectedTournament.name}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedTournament.bracketType || 'Single Elimination'} format
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('Generate brackets for all approved teams? This will create matches automatically.')) return;
                  // Simple bracket generation - can be enhanced later
                  const approvedTeams = (selectedTournament.teams || []).filter(t => 
                    t.status === 'Approved' || t.status === 'Paid'
                  );
                  if (approvedTeams.length < 2) {
                    alert('Need at least 2 approved teams to generate brackets');
                    return;
                  }
                  // This is a placeholder - full bracket generation would be more complex
                  alert('Bracket generation feature coming soon. Please create matches manually in the Schedule tab.');
                }}
                className="px-4 py-2 bg-primary text-primary-content rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                Generate Brackets
              </button>
            </div>
            <div className="p-8">
              {selectedTournament.matches && selectedTournament.matches.length > 0 ? (
                <div className="space-y-6">
                  {['Finals', 'Semifinals', 'Quarterfinals', 'Round 1'].map(round => {
                    const roundMatches = filteredMatches.filter(m => m.round === round);
                    if (roundMatches.length === 0) return null;
                    return (
                      <div key={round} className="border border-gray-200 rounded-xl p-6">
                        <h4 className="text-lg font-black text-gray-900 mb-4">{round}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roundMatches.map(match => (
                            <div key={match.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                  Match #{match.matchNumber}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                  match.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                  match.status === 'Live' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {match.status}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className={`p-2 rounded-lg ${match.winnerId === match.teamAId ? 'bg-primary/10 border-2 border-primary' : 'bg-white'}`}>
                                  <p className="font-black text-sm">{match.teamAName}</p>
                                  {match.score && (
                                    <p className="text-lg font-black text-primary mt-1">{match.score.teamA}</p>
                                  )}
                                </div>
                                <div className="text-center text-gray-400 font-black">VS</div>
                                <div className={`p-2 rounded-lg ${match.winnerId === match.teamBId ? 'bg-primary/10 border-2 border-primary' : 'bg-white'}`}>
                                  <p className="font-black text-sm">{match.teamBName}</p>
                                  {match.score && (
                                    <p className="text-lg font-black text-primary mt-1">{match.score.teamB}</p>
                                  )}
                                </div>
                              </div>
                              {match.winnerName && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs text-gray-500">Winner:</p>
                                  <p className="font-black text-primary">{match.winnerName}</p>
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  setEditingMatch(match);
                                  setShowMatchModal(true);
                                }}
                                className="mt-3 w-full px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-black hover:bg-primary/20 transition-all"
                              >
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
                <div className="text-center py-12 text-gray-500">
                  <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">tournament</span>
                  <p className="text-sm font-medium">No matches created yet</p>
                  <p className="text-xs text-gray-400 mt-2">Create matches in the Schedule tab to see brackets</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!selectedTournament && filteredTournaments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-500">Select a tournament from the list above to view details.</p>
          </div>
        )}
      </div>

      <TournamentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingTournament(null);
        }}
        tournament={editingTournament}
        onSuccess={() => {
          setIsFormModalOpen(false);
          setEditingTournament(null);
        }}
      />

      <TeamRegistrationModal
        isOpen={showTeamModal}
        onClose={() => {
          setShowTeamModal(false);
          setEditingTeam(null);
        }}
        tournament={selectedTournament}
        team={editingTeam}
        onSuccess={() => {
          setShowTeamModal(false);
          setEditingTeam(null);
        }}
      />

      <MatchManagementModal
        isOpen={showMatchModal}
        onClose={() => {
          setShowMatchModal(false);
          setEditingMatch(null);
        }}
        tournament={selectedTournament}
        match={editingMatch}
        onSuccess={() => {
          setShowMatchModal(false);
          setEditingMatch(null);
        }}
      />

      <SportManagementModal
        isOpen={showSportModal}
        onClose={() => setShowSportModal(false)}
        sports={sports}
        onUpdate={() => {
          // Sports will update automatically via realtime subscription
        }}
      />
    </div>
  );
};

export default Tournaments;
