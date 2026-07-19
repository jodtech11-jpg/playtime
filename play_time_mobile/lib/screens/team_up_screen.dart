import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_colors.dart';
import '../widgets/bottom_nav.dart';
import '../providers/team_provider.dart';
import '../providers/venue_provider.dart';
import '../providers/engagement_provider.dart';
import '../models/team.dart';
import '../models/quick_match.dart';
import '../widgets/create_team_modal.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';

class TeamUpScreen extends StatefulWidget {
  const TeamUpScreen({super.key});

  @override
  State<TeamUpScreen> createState() => _TeamUpScreenState();
}

class _TeamUpScreenState extends State<TeamUpScreen> {
  int _activeTab = 0; // 0 = matches, 1 = teams
  final TextEditingController _teamNameController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();
  String _matchType = 'doubles'; // 'singles' or 'doubles'
  bool _isSearchOpen = false;
  String _sortOrder = 'recent'; // 'recent' or 'oldest'

  @override
  void dispose() {
    _teamNameController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final teamProvider = Provider.of<TeamProvider>(context);
    final venueProvider = Provider.of<VenueProvider>(context);
    final teams = teamProvider.teams;
    final venues = venueProvider.venues;

    // Calculate total active courts from all venues
    int getTotalActiveCourts() {
      int totalCourts = 0;
      for (var venue in venues) {
        // Count courts from venue's courts list if available
        if (venue.courts != null && venue.courts!.isNotEmpty) {
          totalCourts += venue.courts!.length;
        }
      }
      return totalCourts;
    }

    final activeCourtsCount = getTotalActiveCourts();

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          if (Navigator.canPop(context)) {
            context.pop();
          } else {
            context.go('/home');
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: SafeArea(
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.backgroundDark.withValues(alpha: 0.95),
                  border: Border(
                    bottom: BorderSide(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceDark,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                            child: const Icon(
                              Icons.arrow_back,
                              color: Colors.white,
                            ),
                          ),
                          onPressed: () {
                            if (Navigator.canPop(context)) {
                              context.pop();
                            } else {
                              context.go('/home');
                            }
                          },
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Social hub',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              Text(
                                'Play with your crew',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: _isSearchOpen
                                  ? AppColors.primary
                                  : AppColors.surfaceDark,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                            child: Icon(
                              _isSearchOpen ? Icons.close : Icons.search,
                              color: _isSearchOpen
                                  ? AppColors.backgroundDark
                                  : Colors.white,
                            ),
                          ),
                          onPressed: () {
                            setState(() {
                              _isSearchOpen = !_isSearchOpen;
                              if (!_isSearchOpen) {
                                _searchController.clear();
                              }
                            });
                          },
                        ),
                        IconButton(
                          icon: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceDark,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                            child: const Icon(
                              Icons.settings,
                              color: Colors.white,
                            ),
                          ),
                          onPressed: () => _showSettingsModal(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Search Bar (if search is open)
                    if (_isSearchOpen) ...[
                      Container(
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceDark,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.1),
                          ),
                        ),
                        child: TextField(
                          controller: _searchController,
                          autofocus: true,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Search teams, players...',
                            hintStyle: TextStyle(color: Colors.grey[600]),
                            prefixIcon: const Icon(
                              Icons.search,
                              color: Colors.grey,
                            ),
                            suffixIcon: _searchController.text.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(
                                      Icons.clear,
                                      color: Colors.grey,
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _searchController.clear();
                                      });
                                    },
                                  )
                                : null,
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                          ),
                          onChanged: (value) => setState(() {}),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    // Tab Switcher
                    Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _activeTab = 0),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color: _activeTab == 0
                                        ? AppColors.primary
                                        : Colors.transparent,
                                    width: 2,
                                  ),
                                ),
                              ),
                              child: Text(
                                'JOIN MATCH',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: _activeTab == 0
                                      ? AppColors.primary
                                      : Colors.grey[500],
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.35,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _activeTab = 1),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color: _activeTab == 1
                                        ? AppColors.primary
                                        : Colors.transparent,
                                    width: 2,
                                  ),
                                ),
                              ),
                              child: Text(
                                'MY TEAMS',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: _activeTab == 1
                                      ? AppColors.primary
                                      : Colors.grey[500],
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.35,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Content
              Expanded(
                child: _activeTab == 0
                    ? _buildJoinMatchTab(activeCourtsCount)
                    : _buildMyTeamsTab(teams, teamProvider),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const BottomNav(currentIndex: 1),
        floatingActionButton: FloatingActionButton(
          onPressed: () => _showCreateTeamModal(teamProvider),
          backgroundColor: AppColors.primary,
          child: const Icon(Icons.add, color: AppColors.backgroundDark),
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      ),
    );
  }

  void _showCreateTeamModal(TeamProvider teamProvider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CreateTeamModal(provider: teamProvider),
    );
  }

  void _showTeamDetailModal(Team team, TeamProvider teamProvider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildTeamDetailModal(team, teamProvider),
    );
  }

  Widget _buildJoinMatchTab(int activeCourtsCount) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Match Type Selector
          Container(
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.surfaceDark,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _matchType = 'singles';
                      });
                    },
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _matchType == 'singles'
                            ? AppColors.primary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'SINGLES',
                        style: TextStyle(
                          color: _matchType == 'singles'
                              ? AppColors.backgroundDark
                              : Colors.grey[400],
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _matchType = 'doubles';
                      });
                    },
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _matchType == 'doubles'
                            ? AppColors.primary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'DOUBLES',
                        style: TextStyle(
                          color: _matchType == 'doubles'
                              ? AppColors.backgroundDark
                              : Colors.grey[400],
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // Quick matches from vendors
          _buildQuickMatchesSection(),
          const SizedBox(height: 24),
          // Open tournaments
          _buildTournamentsSection(),
          const SizedBox(height: 24),
          _buildPollsSection(),
          const SizedBox(height: 24),
          _buildLeaderboardsSection(),
          const SizedBox(height: 24),
          // Near You Section
          const Text(
            'Near You',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            height: 160,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(32),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(32),
                  child: Image.network(
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuCnP1yseuwjdOUtakehlGsirvb_FITfqwxDqpBTNR2G-6ITmlRv-m0JGw6ep6uYE6xalsXfbPcyEhuXE20KVNepa6-kCeC6EIE5Z70ykleTthu0cqbX5SYgSnW-VRR9bG-vu5WTbonAhrPVED5_l3lapSTn9TuJseFURAkoJWushIwxUVSnFmbVosoaOTzdcRDJaauu_T9oYZcm5IqiAZsk2EdePQ_onF7MH0lhZHzwpYG9-Mh8tNLTaoudZFkBd6qDl5P31rH7x81j',
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                    color: Colors.black.withValues(alpha: 0.6),
                    colorBlendMode: BlendMode.darken,
                  ),
                ),
                Positioned(
                  bottom: 20,
                  left: 20,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$activeCourtsCount Active ${activeCourtsCount == 1 ? 'Court' : 'Courts'}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        'in 5km radius',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  bottom: 20,
                  right: 20,
                  child: ElevatedButton(
                    onPressed: () {
                      context.push('/map-view');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.backgroundDark,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'OPEN MAP',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.25,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickMatchesSection() {
    return Consumer<EngagementProvider>(
      builder: (context, engagement, _) {
        if (engagement.isLoading && engagement.quickMatches.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          );
        }

        final matches = engagement.upcomingQuickMatches;
        if (matches.isEmpty) {
          return _buildMatchCardPlaceholder();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Open Matches',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            ...matches
                .take(8)
                .map((match) => _buildQuickMatchCard(match, engagement)),
          ],
        );
      },
    );
  }

  Widget _buildQuickMatchCard(QuickMatch match, EngagementProvider engagement) {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    final joined = userId != null && match.hasJoined(userId);
    final dateLabel = match.date != null
        ? DateFormat('EEE, d MMM').format(match.date!)
        : 'TBD';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  match.sport,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: match.isJoinable
                      ? AppColors.primary.withValues(alpha: 0.2)
                      : Colors.orange.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  match.status,
                  style: TextStyle(
                    color: match.isJoinable ? AppColors.primary : Colors.orange,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${match.venueName ?? 'Venue'} • $dateLabel • ${match.time}',
            style: TextStyle(color: Colors.grey[400], fontSize: 12),
          ),
          if (match.courtName != null && match.courtName!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              match.courtName!,
              style: TextStyle(color: Colors.grey[500], fontSize: 11),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                '${match.currentPlayers}/${match.maxPlayers} players',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (joined)
                const Text(
                  'Joined',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                )
              else if (match.isJoinable)
                ElevatedButton(
                  onPressed: userId == null
                      ? null
                      : () async {
                          try {
                            await engagement.joinMatch(match.id, userId);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Joined match successfully'),
                                ),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(e.toString())),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.backgroundDark,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Join',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTournamentsSection() {
    return Consumer<EngagementProvider>(
      builder: (context, engagement, _) {
        final tournaments = engagement.openTournaments;
        if (tournaments.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tournaments',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            ...tournaments.take(5).map((t) {
              final start = t.startDate != null
                  ? DateFormat('d MMM').format(t.startDate!)
                  : 'TBD';
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceDark,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.06),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.emoji_events,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${t.sport} • ${t.venueName ?? 'Venue'} • $start',
                            style: TextStyle(
                              color: Colors.grey[400],
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            t.canRegister
                                ? 'Registration open • ₹${t.entryFee.toInt()}'
                                : t.status,
                            style: TextStyle(
                              color: t.canRegister
                                  ? AppColors.primary
                                  : Colors.grey[500],
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (engagement.isRegistered(t.id))
                      const Text(
                        'Registered',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      )
                    else
                      FilledButton(
                        onPressed: t.canRegister
                            ? () => _registerTournament(t.id, engagement)
                            : null,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                        ),
                        child: const Text('Register'),
                      ),
                  ],
                ),
              );
            }),
          ],
        );
      },
    );
  }

  Future<void> _registerTournament(
    String tournamentId,
    EngagementProvider engagement,
  ) async {
    final teams = context.read<TeamProvider>().teams;
    String? teamId;
    if (teams.isNotEmpty) {
      teamId = await showDialog<String?>(
        context: context,
        builder: (dialogContext) => SimpleDialog(
          title: const Text('Register tournament'),
          children: [
            SimpleDialogOption(
              onPressed: () => Navigator.pop(dialogContext, ''),
              child: const Text('Register as an individual'),
            ),
            ...teams.map(
              (team) => SimpleDialogOption(
                onPressed: () => Navigator.pop(dialogContext, team.id),
                child: Text('Register ${team.name}'),
              ),
            ),
          ],
        ),
      );
      if (!mounted) return;
      if (teamId == null) return;
    }
    try {
      await engagement.registerTournament(tournamentId, teamId: teamId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tournament registration submitted')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Widget _buildPollsSection() {
    return Consumer<EngagementProvider>(
      builder: (context, engagement, _) {
        if (engagement.polls.isEmpty) return const SizedBox.shrink();
        final userId = FirebaseAuth.instance.currentUser?.uid;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Community polls',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            ...engagement.polls.map((poll) {
              final hasVoted = userId != null && poll.hasVoted(userId);
              return Card(
                color: AppColors.surfaceDark,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        poll.question,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...poll.options.map((option) {
                        final fraction = poll.totalVotes == 0
                            ? 0.0
                            : option.votes / poll.totalVotes;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: OutlinedButton(
                            onPressed: userId == null || hasVoted
                                ? null
                                : () async {
                                    try {
                                      await engagement.vote(
                                        poll.id,
                                        option.id,
                                        userId,
                                      );
                                    } catch (e) {
                                      if (!context.mounted) return;
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(content: Text(e.toString())),
                                      );
                                    }
                                  },
                            child: Row(
                              children: [
                                Expanded(child: Text(option.text)),
                                Text(
                                  hasVoted
                                      ? '${(fraction * 100).round()}%'
                                      : '${option.votes}',
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      if (hasVoted)
                        Text(
                          'Vote recorded • ${poll.totalVotes} total',
                          style: const TextStyle(color: AppColors.primary),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  Widget _buildLeaderboardsSection() {
    return Consumer<EngagementProvider>(
      builder: (context, engagement, _) {
        if (engagement.leaderboards.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Leaderboards',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            ...engagement.leaderboards.map(
              (board) => Card(
                color: AppColors.surfaceDark,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${board.sport} • ${board.venueName ?? board.type}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ...board.entries
                          .take(10)
                          .map(
                            (entry) => ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                child: Text(
                                  entry.rank > 0 ? '${entry.rank}' : '–',
                                ),
                              ),
                              title: Text(
                                entry.userName ?? 'Player',
                                style: const TextStyle(color: Colors.white),
                              ),
                              subtitle: Text(
                                '${entry.wins}W • ${entry.losses}L • ${entry.matchesPlayed} played',
                              ),
                              trailing: Text(
                                entry.score.toStringAsFixed(0),
                                style: const TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildMatchCardPlaceholder() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        children: [
          Icon(Icons.sports_soccer, size: 64, color: Colors.grey[600]),
          const SizedBox(height: 16),
          Text(
            'No matches available',
            style: TextStyle(
              color: Colors.grey[400],
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'When vendors create quick matches, they will appear here',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyTeamsTab(List<Team> teams, TeamProvider provider) {
    if (provider.isLoading && teams.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }
    // Filter teams based on search query
    final searchQuery = _searchController.text.trim().toLowerCase();
    var filteredTeams = searchQuery.isEmpty
        ? teams
        : teams.where((team) {
            return team.name.toLowerCase().contains(searchQuery) ||
                team.sport.toLowerCase().contains(searchQuery);
          }).toList();

    // Apply sorting - sort by name for now (can be enhanced with createdAt field later)
    filteredTeams = List.from(filteredTeams);
    filteredTeams.sort((a, b) {
      if (_sortOrder == 'recent') {
        // Sort by name descending (Z to A)
        return b.name.compareTo(a.name);
      } else {
        // Sort by name ascending (A to Z)
        return a.name.compareTo(b.name);
      }
    });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ACTIVE SQUADS (${filteredTeams.length})',
                style: TextStyle(
                  color: Colors.grey[500],
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.35,
                ),
              ),
              TextButton(
                onPressed: () {
                  setState(() {
                    _sortOrder = _sortOrder == 'recent' ? 'oldest' : 'recent';
                  });
                },
                child: Text(
                  _sortOrder == 'recent' ? 'RECENT FIRST' : 'OLDEST FIRST',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.25,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (filteredTeams.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(
                  children: [
                    Icon(Icons.groups_3, size: 64, color: Colors.grey[600]),
                    const SizedBox(height: 16),
                    Text(
                      'No teams yet',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Start by creating your own squad',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.25,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            ...filteredTeams.map((team) => _buildTeamCard(team, provider)),
        ],
      ),
    );
  }

  Widget _buildTeamCard(Team team, TeamProvider teamProvider) {
    return GestureDetector(
      onTap: () => _showTeamDetailModal(team, teamProvider),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Center(
                child: Text(team.logo, style: const TextStyle(fontSize: 32)),
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    team.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          team.sport.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.25,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[700],
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Flexible(
                        child: Text(
                          '${team.members.length} Members',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.25,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.emoji_events,
                      color: Colors.amber,
                      size: 18,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${team.matchesWon}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'WINS',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.25,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTeamDetailModal(Team team, TeamProvider provider) {
    return Positioned.fill(
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.surfaceDark,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: const Icon(Icons.arrow_back, color: Colors.white),
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text(
            'Manage Squad',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.edit, color: AppColors.primary),
              onPressed: () {},
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    width: 2,
                  ),
                ),
                child: Center(
                  child: Text(team.logo, style: const TextStyle(fontSize: 48)),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                team.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${team.sport} SQUAD',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.35,
                ),
              ),
              const SizedBox(height: 40),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.05),
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            '${team.matchesWon}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'WINS',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.05),
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            '${team.members.length}/15',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'SQUAD SIZE',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'MEMBER LIST',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.35,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Invitation link copied!'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.person_add, size: 18),
                    label: const Text(
                      'INVITE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.25,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                      foregroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: AppColors.primary.withValues(alpha: 0.3),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ...team.members.map(
                (member) => Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceDark,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(
                          member.avatar,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              member.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(
                                  Icons.verified,
                                  color: AppColors.primary,
                                  size: 12,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  member.status.toUpperCase(),
                                  style: TextStyle(
                                    color: Colors.grey[500],
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.25,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      DropdownButton<String>(
                        value: member.role,
                        dropdownColor: AppColors.backgroundDark,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                        underline: Container(),
                        items:
                            [
                              'Captain',
                              'Defender',
                              'Midfield',
                              'Forward',
                              'Goalie',
                              'Tactician',
                            ].map((role) {
                              return DropdownMenuItem(
                                value: role,
                                child: Text(role.toUpperCase()),
                              );
                            }).toList(),
                        onChanged: (newRole) {
                          if (newRole != null) {
                            provider.updateMemberRole(
                              team.id,
                              member.id,
                              newRole,
                            );
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.schedule),
                  label: const Text(
                    'TEAM TRAINING SCHEDULE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.25,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'LEAVE SQUAD',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.25,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSettingsModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'SETTINGS',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.35,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.grey),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildSettingsOption(
                      icon: Icons.notifications,
                      title: 'Notifications',
                      subtitle: 'Manage match and team notifications',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/notifications');
                      },
                    ),
                    _buildSettingsOption(
                      icon: Icons.people,
                      title: 'Team Preferences',
                      subtitle: 'Set your team preferences',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/team-preferences');
                      },
                    ),
                    _buildSettingsOption(
                      icon: Icons.filter_list,
                      title: 'Match Filters',
                      subtitle: 'Customize match discovery',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/match-filters');
                      },
                    ),
                    _buildSettingsOption(
                      icon: Icons.help_outline,
                      title: 'Help & Support',
                      subtitle: 'Get help with team features',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/help-support');
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingsOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.grey[500], size: 20),
          ],
        ),
      ),
    );
  }
}
