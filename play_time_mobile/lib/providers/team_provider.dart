import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/team.dart';
import '../services/firestore_service.dart';
import '../services/team_membership_service.dart';

final _firestore = FirebaseFirestore.instance;

class TeamProvider with ChangeNotifier {
  List<Team> _teams = [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription<List<Team>>? _teamsSubscription;

  List<Team> get teams => _teams;
  bool get isLoading => _isLoading;
  String? get error => _error;

  TeamProvider() {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadTeams(user.uid);
    }

    // Listen to auth state changes
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        _loadTeams(user.uid);
      } else {
        _teams = [];
        notifyListeners();
      }
    });
  }

  void _loadTeams(String userId) {
    _isLoading = true;
    _error = null;
    notifyListeners();

    _teamsSubscription?.cancel();
    _teamsSubscription = FirestoreService.getUserTeamsStream(userId).listen(
      (teams) {
        _teams = teams;
        _isLoading = false;
        notifyListeners();
      },
      onError: (error) {
        _error = 'Failed to load teams: $error';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  Future<String> createTeam({
    required String name,
    required String sport,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final teamData = {
        'name': name,
        'sport': sport,
        'logo': _getSportLogo(sport),
        'matchesWon': 0,
        'members': [user.uid],
        'createdBy': user.uid, // Required by Firestore rules
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      final teamId = await FirestoreService.createTeam(teamData);
      await refreshTeams();
      return teamId;
    } catch (e) {
      _error = 'Failed to create team: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> updateMemberRole(
    String teamId,
    String memberId,
    String newRole,
  ) async {
    try {
      await _firestore.collection('teams').doc(teamId).update({
        'memberRoles.$memberId': newRole,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      await refreshTeams();
    } catch (e) {
      _error = 'Failed to update member role: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> updateTeamDetails({
    required String teamId,
    required String name,
    required String sport,
  }) async {
    final normalizedName = name.trim();
    if (normalizedName.isEmpty) throw Exception('Squad name is required.');
    try {
      await _firestore.collection('teams').doc(teamId).update({
        'name': normalizedName,
        'sport': sport,
        'logo': _getSportLogo(sport),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      _error = 'Failed to update squad: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> scheduleTraining({
    required String teamId,
    required DateTime trainingAt,
    required String venue,
    String? notes,
  }) async {
    if (!trainingAt.isAfter(DateTime.now())) {
      throw Exception('Choose a future training time.');
    }
    try {
      await _firestore.collection('teams').doc(teamId).update({
        'trainingAt': Timestamp.fromDate(trainingAt),
        'trainingVenue': venue.trim(),
        'trainingNotes': notes?.trim(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      _error = 'Failed to schedule training: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> joinTeam(String teamId) async {
    await TeamMembershipService.update(teamId: teamId, action: 'join');
  }

  Future<void> leaveTeam(String teamId) async {
    await TeamMembershipService.update(teamId: teamId, action: 'leave');
  }

  Future<void> refreshTeams() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadTeams(user.uid);
    }
  }

  String _getSportLogo(String sport) {
    switch (sport) {
      case 'Football':
        return '⚽';
      case 'Cricket':
        return '🏏';
      case 'Badminton':
        return '🏸';
      case 'Tennis':
        return '🎾';
      case 'Basketball':
        return '🏀';
      case 'Volleyball':
        return '🏐';
      case 'Table Tennis':
        return '🏓';
      default:
        return '🏅';
    }
  }

  @override
  void dispose() {
    _teamsSubscription?.cancel();
    super.dispose();
  }
}
