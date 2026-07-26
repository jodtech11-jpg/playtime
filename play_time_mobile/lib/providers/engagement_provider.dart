import 'dart:async';

import 'package:flutter/foundation.dart';
import '../models/quick_match.dart';
import '../models/tournament_summary.dart';
import '../models/engagement.dart';
import '../services/firestore_service.dart';
import '../services/tournament_registration_service.dart';

/// Loads vendor-created engagement content for the player app:
/// quick matches, tournaments, polls, flash deals, campaigns, leaderboards.
class EngagementProvider with ChangeNotifier {
  List<QuickMatch> _quickMatches = [];
  List<TournamentSummary> _tournaments = [];
  List<AppPoll> _polls = [];
  List<FlashDealItem> _flashDeals = [];
  List<MarketingCampaignItem> _campaigns = [];
  List<AppLeaderboard> _leaderboards = [];
  bool _isLoading = false;
  String? _error;
  String? _venueFilter;
  final Set<String> _registeredTournamentIds = {};

  List<QuickMatch> get quickMatches => _quickMatches;
  List<TournamentSummary> get tournaments => _tournaments;
  List<AppPoll> get polls => _polls;
  List<FlashDealItem> get flashDeals => _flashDeals;
  List<MarketingCampaignItem> get campaigns => _campaigns;
  List<AppLeaderboard> get leaderboards => _leaderboards;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get venueFilter => _venueFilter;
  bool isRegistered(String tournamentId) =>
      _registeredTournamentIds.contains(tournamentId);

  List<QuickMatch> get upcomingQuickMatches => _quickMatches
      .where((m) => m.status == 'Open' || m.status == 'Full')
      .toList();

  List<TournamentSummary> get openTournaments => _tournaments
      .where((t) => t.status == 'Open' || t.status == 'Ongoing')
      .toList();

  /// Venue-scoped helpers (does not change the global load).
  List<QuickMatch> upcomingQuickMatchesForVenue(String venueId) =>
      upcomingQuickMatches.where((m) => m.venueId == venueId).toList();

  List<TournamentSummary> openTournamentsForVenue(String venueId) =>
      openTournaments.where((t) => t.venueId == venueId).toList();

  List<AppPoll> pollsForVenue(String venueId) =>
      _polls.where((p) => p.venueId == null || p.venueId == venueId).toList();

  List<FlashDealItem> flashDealsForVenue(String venueId) =>
      _flashDeals.where((d) => d.venueId == venueId).toList();

  EngagementProvider() {
    unawaited(loadAll());
  }

  Future<void> loadAll({String? venueId}) async {
    _isLoading = true;
    _error = null;
    _venueFilter = venueId;
    notifyListeners();

    try {
      final results = await Future.wait([
        FirestoreService.getOpenQuickMatches(venueId: venueId),
        FirestoreService.getOpenTournaments(venueId: venueId),
        FirestoreService.getActivePolls(venueId: venueId),
        FirestoreService.getActiveFlashDeals(venueId: venueId),
        FirestoreService.getLiveCampaigns(),
        FirestoreService.getLeaderboards(venueId: venueId),
      ]);

      _quickMatches = results[0] as List<QuickMatch>;
      _tournaments = results[1] as List<TournamentSummary>;
      _polls = results[2] as List<AppPoll>;
      _flashDeals = results[3] as List<FlashDealItem>;
      _campaigns = results[4] as List<MarketingCampaignItem>;
      _leaderboards = results[5] as List<AppLeaderboard>;
    } catch (e) {
      _error = 'Failed to load matches and offers: $e';
      debugPrint(_error);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refresh() => loadAll(venueId: _venueFilter);

  void setVenueFilter(String? venueId) {
    final normalized = venueId?.isNotEmpty == true ? venueId : null;
    if (_venueFilter == normalized) return;
    unawaited(loadAll(venueId: normalized));
  }

  Future<void> joinMatch(String matchId) async {
    await FirestoreService.joinQuickMatch(matchId);
    await refresh();
  }

  Future<void> vote(String pollId, String optionId, String userId) async {
    await FirestoreService.votePoll(
      pollId: pollId,
      optionId: optionId,
      userId: userId,
    );
    await refresh();
  }

  Future<void> registerTournament(String tournamentId, {String? teamId}) async {
    if (_registeredTournamentIds.contains(tournamentId)) {
      throw const TournamentRegistrationException(
        'You are already registered for this tournament.',
      );
    }
    await TournamentRegistrationService.register(
      tournamentId: tournamentId,
      teamId: teamId,
    );
    _registeredTournamentIds.add(tournamentId);
    notifyListeners();
    await refresh();
  }
}
