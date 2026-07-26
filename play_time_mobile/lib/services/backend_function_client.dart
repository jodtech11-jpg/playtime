import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:http/http.dart' as http;

class BackendFunctionException implements Exception {
  final String message;
  final int? statusCode;

  const BackendFunctionException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class BackendFunctionClient {
  static const _configuredBase = String.fromEnvironment('FUNCTIONS_BASE_URL');

  static Uri endpoint(String functionName) {
    final projectId = Firebase.app().options.projectId;
    final defaultBase = projectId.isEmpty
        ? ''
        : 'https://us-central1-$projectId.cloudfunctions.net';
    final base = (_configuredBase.isEmpty ? defaultBase : _configuredBase)
        .replaceAll(RegExp(r'/$'), '');
    final uri = base.isEmpty ? null : Uri.tryParse('$base/$functionName');
    if (uri == null) {
      throw const BackendFunctionException(
        'Server functions are not configured for this build.',
      );
    }
    return uri;
  }

  static Future<Map<String, dynamic>> post(
    String functionName,
    Map<String, dynamic> body, {
    http.Client? client,
    Duration timeout = const Duration(seconds: 25),
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw const BackendFunctionException(
        'Your session has expired. Please sign in again.',
      );
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const BackendFunctionException(
        'Could not verify your session. Please sign in again.',
      );
    }

    final requestClient = client ?? http.Client();
    try {
      final response = await requestClient
          .post(
            endpoint(functionName),
            headers: {
              'authorization': 'Bearer $token',
              'content-type': 'application/json',
              'accept': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(timeout);
      final Object? decoded = response.body.isEmpty
          ? null
          : jsonDecode(response.body);
      final data = decoded is Map
          ? decoded.map((key, value) => MapEntry('$key', value))
          : <String, dynamic>{};
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final nestedError = data['error'];
        final message = nestedError is Map
            ? nestedError['message']?.toString()
            : nestedError?.toString();
        throw BackendFunctionException(
          message ?? data['message']?.toString() ?? 'Server request failed.',
          statusCode: response.statusCode,
        );
      }
      return data;
    } on BackendFunctionException {
      rethrow;
    } on FormatException {
      throw const BackendFunctionException(
        'The server returned an invalid response. Please try again.',
      );
    } catch (_) {
      throw const BackendFunctionException(
        'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      if (client == null) requestClient.close();
    }
  }
}
