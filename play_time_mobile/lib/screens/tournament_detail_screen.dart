import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/tournament_summary.dart';
import '../providers/engagement_provider.dart';
import '../providers/feature_flags_provider.dart';
import '../providers/team_provider.dart';
import '../services/firestore_service.dart';
import '../theme/app_colors.dart';
import '../utils/feature_navigation.dart';

class TournamentDetailScreen extends StatefulWidget {
  final String tournamentId;

  const TournamentDetailScreen({super.key, required this.tournamentId});

  @override
  State<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends State<TournamentDetailScreen> {
  TournamentSummary? _tournament;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final t = await FirestoreService.getTournament(widget.tournamentId);
      if (!mounted) return;
      setState(() {
        _tournament = t;
        _loading = false;
        if (t == null) _error = 'Tournament not found';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _share() async {
    final t = _tournament;
    if (t == null) return;
    final text =
        '${t.name}\n'
        '${t.sport} at ${t.displayVenueName}\n'
        '${t.formattedDate} • ${t.formattedTimeRange}\n'
        'Entry Fee: ₹${t.entryFee.toInt()}\n'
        '${t.registrationStatusLabel}\n'
        'Open in Play Time: /tournament/${t.id}';
    await Share.share(text);
  }

  Future<void> _openMaps() async {
    final t = _tournament;
    if (t == null) return;
    Uri uri;
    if (t.venueLat != null && t.venueLng != null) {
      uri = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${t.venueLat},${t.venueLng}',
      );
    } else {
      final q = Uri.encodeComponent(
        '${t.displayVenueName} ${t.venueAddress ?? ''}'.trim(),
      );
      uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$q');
    }
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _register() async {
    final engagement = context.read<EngagementProvider>();
    final teams = context.read<TeamProvider>().teams;
    String? teamId;
    if (teams.isNotEmpty) {
      teamId = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppColors.surfaceDark,
          title: const Text(
            'Register tournament',
            style: TextStyle(color: Colors.white),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Optional: register with a team',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              ...teams.map(
                (team) => ListTile(
                  title: Text(
                    team.name,
                    style: const TextStyle(color: Colors.white),
                  ),
                  onTap: () => Navigator.pop(ctx, team.id),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, ''),
                child: const Text('Register without team'),
              ),
            ],
          ),
        ),
      );
      if (teamId == null) return;
      if (teamId.isEmpty) teamId = null;
    }

    try {
      await engagement.registerTournament(
        widget.tournamentId,
        teamId: teamId,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tournament registration submitted'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 2),
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final flags = context.watch<FeatureFlagsProvider>();
    if (flags.tournament.isHidden) {
      return featureScreenGate(
        context: context,
        featureKey: 'tournament',
        child: const SizedBox.shrink(),
      );
    }
    if (flags.tournament.isComingSoon) {
      return const ComingSoonInline(featureKey: 'tournament');
    }

    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (_error != null || _tournament == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: AppColors.backgroundDark,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => context.pop(),
          ),
        ),
        body: Center(
          child: Text(
            _error ?? 'Tournament not found',
            style: const TextStyle(color: Colors.white70),
          ),
        ),
      );
    }

    final t = _tournament!;
    final engagement = context.watch<EngagementProvider>();
    final registered = engagement.isRegistered(t.id);
    final canRegister = t.canRegister && !registered;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            backgroundColor: AppColors.backgroundDark,
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.arrow_back, color: Colors.white),
              ),
              onPressed: () => context.pop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: t.bannerImage != null && t.bannerImage!.isNotEmpty
                  ? Image.network(
                      t.bannerImage!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _bannerFallback(),
                    )
                  : _bannerFallback(),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _statusChip(t.registrationStatusLabel, t.canRegister),
                  const SizedBox(height: 20),
                  _infoBlock('Venue', t.displayVenueName, subtitle: t.venueAddress),
                  _infoBlock('Date', t.formattedDate),
                  _infoBlock('Time', t.formattedTimeRange),
                  _infoBlock('Game', t.sport.isEmpty ? '—' : t.sport),
                  if (t.organizer != null && t.organizer!.trim().isNotEmpty)
                    _infoBlock('Organizer', t.organizer!),
                  _infoBlock('Entry Fee', '₹${t.entryFee.toInt()}'),
                  if (t.prizePool != null)
                    _infoBlock(
                      'Prize Pool',
                      '₹${t.prizePool!.toInt()}',
                    ),
                  _infoBlock(
                    'Maximum Players',
                    t.maxTeams?.toString() ?? '—',
                  ),
                  _infoBlock(
                    'Registered Players',
                    t.maxTeams != null
                        ? '${t.teamCount} / ${t.maxTeams}'
                        : '${t.teamCount}',
                  ),
                  if (t.rules != null && t.rules!.trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Tournament Rules',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      t.rules!,
                      style: TextStyle(
                        color: Colors.grey[300],
                        height: 1.45,
                        fontSize: 14,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  const Text(
                    'Location',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceDark,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t.displayVenueName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (t.venueAddress != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            t.venueAddress!,
                            style: TextStyle(
                              color: Colors.grey[400],
                              fontSize: 13,
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _openMaps,
                          icon: const Icon(Icons.directions),
                          label: const Text('Open in Google Maps'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _share,
                  icon: const Icon(Icons.share),
                  label: const Text('Share'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: canRegister ? _register : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.backgroundDark,
                    disabledBackgroundColor: Colors.grey[800],
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(
                    registered
                        ? 'Registered'
                        : (canRegister ? 'Register Now' : t.registrationStatusLabel),
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bannerFallback() {
    return Container(
      color: AppColors.surfaceDark,
      alignment: Alignment.center,
      child: const Icon(Icons.emoji_events, color: AppColors.primary, size: 64),
    );
  }

  Widget _statusChip(String label, bool open) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: open
            ? AppColors.primary.withValues(alpha: 0.2)
            : Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: open ? AppColors.primary : Colors.white70,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _infoBlock(String label, String value, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtitle != null && subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}
