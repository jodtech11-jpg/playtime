import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:http/http.dart' as http;
import 'package:razorpay_flutter/razorpay_flutter.dart';

class WalletPaymentException implements Exception {
  final String message;

  const WalletPaymentException(this.message);

  @override
  String toString() => message;
}

class WalletPaymentService {
  static const _functionsBase = String.fromEnvironment('FUNCTIONS_BASE_URL');
  static final Razorpay _razorpay = Razorpay();

  static Uri? get _endpoint {
    final projectId = Firebase.app().options.projectId;
    final defaultBase = projectId.isEmpty
        ? ''
        : 'https://us-central1-$projectId.cloudfunctions.net';
    final base = (_functionsBase.isEmpty ? defaultBase : _functionsBase)
        .replaceAll(RegExp(r'/$'), '');
    return base.isEmpty ? null : Uri.tryParse('$base/createWalletTopUpOrder');
  }

  static Future<Map<String, dynamic>> _createOrder(int amount) async {
    final user = FirebaseAuth.instance.currentUser;
    final endpoint = _endpoint;
    if (user == null || endpoint == null) {
      throw const WalletPaymentException(
        'Wallet payments are not configured for this build.',
      );
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const WalletPaymentException(
        'Could not verify your session. Please sign in again.',
      );
    }

    final response = await http
        .post(
          endpoint,
          headers: {
            'authorization': 'Bearer $token',
            'content-type': 'application/json',
            'accept': 'application/json',
          },
          body: jsonEncode({'amount': amount}),
        )
        .timeout(const Duration(seconds: 25));
    final decoded = response.body.isEmpty
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw WalletPaymentException(
        decoded['error']?.toString() ?? 'Could not start wallet payment.',
      );
    }
    return decoded;
  }

  static Future<void> startTopUp({
    required int amount,
    required void Function(String paymentId) onSuccess,
    required void Function(String message) onError,
  }) async {
    if (amount < 10 || amount > 50000) {
      onError('Enter an amount between ₹10 and ₹50,000.');
      return;
    }
    try {
      final order = await _createOrder(amount);
      final user = FirebaseAuth.instance.currentUser;

      _razorpay.clear();
      _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (
        PaymentSuccessResponse response,
      ) {
        final paymentId = response.paymentId;
        if (paymentId == null || paymentId.isEmpty) {
          onError('Payment completed without a receipt. Contact support.');
          return;
        }
        onSuccess(paymentId);
      });
      _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (
        PaymentFailureResponse response,
      ) {
        onError(response.message ?? 'Wallet payment failed.');
      });
      _razorpay.open({
        'key': order['keyId'],
        'amount': order['amountPaise'],
        'currency': order['currency'] ?? 'INR',
        'order_id': order['orderId'],
        'name': 'Play Time',
        'description': 'Wallet top-up',
        'prefill': {
          'email': user?.email ?? '',
          'contact': user?.phoneNumber ?? '',
        },
        'theme': {'color': '#0DF259'},
      });
    } on WalletPaymentException catch (error) {
      onError(error.message);
    } catch (_) {
      onError('Could not start wallet payment. Try again.');
    }
  }
}
