import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:http/http.dart' as http;

class TeamMembershipException implements Exception {
  final String message;

  const TeamMembershipException(this.message);

  @override
  String toString() => message;
}

class TeamMembershipService {
  static const _functionsBase = String.fromEnvironment('FUNCTIONS_BASE_URL');

  static Uri? get _endpoint {
    final projectId = Firebase.app().options.projectId;
    final defaultBase = projectId.isEmpty
        ? ''
        : 'https://us-central1-$projectId.cloudfunctions.net';
    final base = (_functionsBase.isEmpty ? defaultBase : _functionsBase)
        .replaceAll(RegExp(r'/$'), '');
    return base.isEmpty ? null : Uri.tryParse('$base/updateTeamMembership');
  }

  static Future<void> update({
    required String teamId,
    required String action,
    http.Client? client,
  }) async {
    final endpoint = _endpoint;
    final user = FirebaseAuth.instance.currentUser;
    if (endpoint == null || user == null) {
      throw const TeamMembershipException(
        'Please sign in again before joining this squad.',
      );
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const TeamMembershipException('Could not verify your session.');
    }

    final requestClient = client ?? http.Client();
    try {
      final response = await requestClient
          .post(
            endpoint,
            headers: {
              'authorization': 'Bearer $token',
              'content-type': 'application/json',
              'accept': 'application/json',
            },
            body: jsonEncode({'teamId': teamId, 'action': action}),
          )
          .timeout(const Duration(seconds: 20));
      final decoded = response.body.isEmpty
          ? null
          : jsonDecode(response.body) as Object?;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = decoded is Map ? decoded['error']?.toString() : null;
        throw TeamMembershipException(
          message ?? 'Could not $action this squad.',
        );
      }
    } on TeamMembershipException {
      rethrow;
    } catch (_) {
      throw TeamMembershipException(
        'Could not $action this squad. Check your connection and try again.',
      );
    } finally {
      if (client == null) requestClient.close();
    }
  }
}
