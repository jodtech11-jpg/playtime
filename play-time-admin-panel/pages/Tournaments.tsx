import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournaments } from '../hooks/useTournaments';
import { useVenues } from '../hooks/useVenues';
import { useSports } from '../hooks/useSports';
import { tournamentsCollection } from '../services/firebase';
import { Tournament } from '../types';
import { useHeaderActions } from '../contexts/HeaderActionsContext';
import { formatCurrency, getStatusColor } from '../utils/formatUtils';
import { formatDate } from '../utils/dateUtils';
import TournamentFormModal from '../components/modals/TournamentFormModal';
import SportManagementModal from '../components/modals/SportManagementModal';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

const Tournaments: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const { setNewEntryHandler, unsetNewEntryHandler } = useHeaderActions();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Tournament['status']>('All');
  const [venueFilter, setVenueFilter] = useState<string>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [showSportModal, setShowSportModal] = useState(false);

  const { tournaments, loading } = useTournaments({ realtime: true });
  const { venues } = useVenues({ realtime: true });
  const { sports, loading: sportsLoading } = useSports({ activeOnly: false, realtime: true });

  // Get sport name by ID (must be defined before useMemo that uses it)
  const getSportName = useCallback((sportId: string): string => {
    const sport = sports.find(s => s.id === sportId);
    return sport ? sport.name : sportId; // Fallback to ID if sport not found
  }, [sports]);

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
  }, [tournaments, searchTerm, statusFilter, venueFilter, sportFilter, getSportName]);

  // Overall statistics
  const stats = useMemo(() => {
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
    return { totalTeams, pendingFees, totalMatches, totalRevenue };
  }, [tournaments]);

  // Get venue name
  const getVenueName = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    return venue?.name || 'Unknown Venue';
  };

  // Handle delete
  const handleDelete = (tournament: Tournament) => {
    openConfirm({
      title: 'Delete tournament?',
      message: `"${tournament.name}" will be permanently removed.`,
      onConfirm: async () => {
        try {
          await tournamentsCollection.delete(tournament.id);
        } catch (error: any) {
          console.error('Error deleting tournament:', error);
          showError('Failed to delete tournament: ' + error.message);
        }
      },
    });
  };

  // Handle edit
  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setIsFormModalOpen(true);
  };

  // Handle create
  const handleCreate = useCallback(() => {
    setEditingTournament(null);
    setIsFormModalOpen(true);
  }, []);

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

    // UTF-8 BOM so Excel displays ₹ and other Unicode correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all-tournaments-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Register "New Entry" handler for Header button — run only once on mount
  const setNewEntryHandlerRef = useRef(setNewEntryHandler);
  const unsetNewEntryHandlerRef = useRef(unsetNewEntryHandler);
  useEffect(() => {
    setNewEntryHandlerRef.current(handleCreate);
    return () => {
      unsetNewEntryHandlerRef.current();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && tournaments.length === 0) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center h-full">
        <div className="text-gray-500">Loading tournaments...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 h-full bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-10">
        <div className="flex flex-wrap justify-between items-end gap-4 sm:gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              Tournaments
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-2xl">
              Manage all tournaments, teams, brackets, and schedules.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateAllTournamentsReport}
              className="h-12 px-6 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all flex items-center gap-2"
              title="Generate report for all tournaments"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
                          className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/tournaments/${tournament.id}`)}
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

      <SportManagementModal
        isOpen={showSportModal}
        onClose={() => setShowSportModal(false)}
        sports={sports}
        onUpdate={() => {
          // Sports will update automatically via realtime subscription
        }}
      />
      {confirmDialog}
    </div>
  );
};

export default Tournaments;
