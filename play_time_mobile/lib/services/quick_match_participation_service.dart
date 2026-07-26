import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:http/http.dart' as http;

class QuickMatchParticipationException implements Exception {
  final String message;

  const QuickMatchParticipationException(this.message);

  @override
  String toString() => message;
}

class QuickMatchParticipationService {
  static const _endpoint = String.fromEnvironment(
    'QUICK_MATCH_PARTICIPATION_URL',
  );
  static const _functionsBase = String.fromEnvironment('FUNCTIONS_BASE_URL');

  static Uri? get endpoint {
    final projectId = Firebase.app().options.projectId;
    final defaultBase = projectId.isEmpty
        ? ''
        : 'https://us-central1-$projectId.cloudfunctions.net';
    final configured = _endpoint.isNotEmpty
        ? _endpoint
        : '${(_functionsBase.isEmpty ? defaultBase : _functionsBase).replaceAll(RegExp(r'/$'), '')}'
              '/updateQuickMatchParticipation';
    return configured.isEmpty ? null : Uri.tryParse(configured);
  }

  static Future<void> join(String matchId, {http.Client? client}) =>
      _update(matchId: matchId, action: 'join', client: client);

  static Future<void> leave(String matchId, {http.Client? client}) =>
      _update(matchId: matchId, action: 'leave', client: client);

  static Future<void> _update({
    required String matchId,
    required String action,
    http.Client? client,
  }) async {
    final uri = endpoint;
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
      throw const QuickMatchParticipationException(
        'Quick-match participation is not configured for this build.',
      );
    }

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw const QuickMatchParticipationException(
        'Please sign in to join this match.',
      );
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const QuickMatchParticipationException(
        'Could not verify your session. Please sign in again.',
      );
    }

    final requestClient = client ?? http.Client();
    try {
      final response = await requestClient
          .post(
            uri,
            headers: {
              'authorization': 'Bearer $token',
              'content-type': 'application/json',
              'accept': 'application/json',
            },
            body: jsonEncode({'matchId': matchId, 'action': action}),
          )
          .timeout(const Duration(seconds: 20));

      Object? decoded;
      try {
        decoded = response.body.isEmpty ? null : jsonDecode(response.body);
      } on FormatException {
        decoded = null;
      }
      final message = decoded is Map
          ? decoded['message']?.toString() ?? decoded['error']?.toString()
          : null;

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw QuickMatchParticipationException(
          message ??
              (response.statusCode == 409
                  ? 'This match is no longer available.'
                  : 'Could not update the match (${response.statusCode}).'),
        );
      }
    } on QuickMatchParticipationException {
      rethrow;
    } catch (_) {
      throw const QuickMatchParticipationException(
        'Could not join this match. Check your connection and try again.',
      );
    } finally {
      if (client == null) requestClient.close();
    }
  }
}
