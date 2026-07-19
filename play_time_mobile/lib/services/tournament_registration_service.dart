import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:http/http.dart' as http;

class TournamentRegistrationException implements Exception {
  final String message;

  const TournamentRegistrationException(this.message);

  @override
  String toString() => message;
}

class TournamentRegistrationService {
  static const _endpoint = String.fromEnvironment(
    'TOURNAMENT_REGISTRATION_URL',
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
              '/registerTournamentPlayer';
    return configured.isEmpty ? null : Uri.tryParse(configured);
  }

  static Future<void> register({
    required String tournamentId,
    String? teamId,
    http.Client? client,
  }) async {
    final uri = endpoint;
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
      throw const TournamentRegistrationException(
        'Tournament registration is not configured for this build.',
      );
    }

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw const TournamentRegistrationException(
        'Please sign in to register.',
      );
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const TournamentRegistrationException(
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
            body: jsonEncode({
              'tournamentId': tournamentId,
              if (teamId != null && teamId.isNotEmpty) 'teamId': teamId,
            }),
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
        throw TournamentRegistrationException(
          message ??
              (response.statusCode == 409
                  ? 'You are already registered for this tournament.'
                  : 'Registration failed (${response.statusCode}).'),
        );
      }
    } on TournamentRegistrationException {
      rethrow;
    } catch (_) {
      throw const TournamentRegistrationException(
        'Could not register right now. Check your connection and try again.',
      );
    } finally {
      if (client == null) requestClient.close();
    }
  }
}
