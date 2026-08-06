import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../models/booking.dart';
import '../models/venue.dart';
import 'backend_function_client.dart';

/// Opens Razorpay orders created by trusted backend functions.
///
/// Payment confirmation, inventory, settlements, and source-document status
/// changes are intentionally handled only by verified server webhooks.
class PaymentService {
  static final Razorpay _razorpay = Razorpay();
  static void Function(String)? _onPaymentSuccess;
  static void Function(String)? _onPaymentError;

  static void initialize({
    required void Function(String paymentId) onSuccess,
    required void Function(String error) onError,
  }) {
    _onPaymentSuccess = onSuccess;
    _onPaymentError = onError;
    _razorpay.clear();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  static void _handlePaymentSuccess(PaymentSuccessResponse response) {
    final paymentId = response.paymentId;
    if (paymentId == null || paymentId.isEmpty) {
      _onPaymentError?.call(
        'Payment completed without a receipt. Contact support.',
      );
      return;
    }
    _onPaymentSuccess?.call(paymentId);
  }

  static void _handlePaymentError(PaymentFailureResponse response) {
    _onPaymentError?.call(response.message ?? 'Payment failed.');
  }

  static void _handleExternalWallet(ExternalWalletResponse response) {
    debugPrint('External wallet selected: ${response.walletName}');
  }

  static Future<void> _startServerOrder({
    required String functionName,
    required Map<String, dynamic> request,
    required String description,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required void Function(String paymentId) onSuccess,
    required void Function(String error) onError,
  }) async {
    try {
      final order = await BackendFunctionClient.post(functionName, request);
      final keyId = order['keyId']?.toString() ?? order['key']?.toString();
      final gatewayOrderId =
          order['orderId']?.toString() ?? order['order_id']?.toString();
      final amountValue = order['amountPaise'] ?? order['amount'];
      final amountPaise = amountValue is num
          ? amountValue.toInt()
          : int.tryParse('$amountValue');
      if (keyId == null ||
          keyId.isEmpty ||
          gatewayOrderId == null ||
          gatewayOrderId.isEmpty ||
          amountPaise == null ||
          amountPaise <= 0) {
        throw const BackendFunctionException(
          'The payment server returned an incomplete order.',
        );
      }

      initialize(
        onSuccess: (paymentId) async {
          try {
            final sourceType = functionName.contains('Booking')
                ? 'Booking'
                : (functionName.contains('Membership')
                    ? 'Membership'
                    : 'Order');
            final sourceId =
                request['bookingId'] ??
                request['membershipId'] ??
                request['orderId'] ??
                '';
            if (sourceId.toString().isNotEmpty) {
              await BackendFunctionClient.post('verifyAndFulfillPayment', {
                'sourceType': sourceType,
                'sourceId': sourceId.toString(),
                'paymentId': paymentId,
                'razorpayOrderId': gatewayOrderId,
              });
            }
          } catch (e) {
            debugPrint('verifyAndFulfillPayment notice: $e');
          }
          onSuccess(paymentId);
        },
        onError: onError,
      );
      _razorpay.open({
        'key': keyId,
        'amount': amountPaise,
        'currency': order['currency']?.toString() ?? 'INR',
        'order_id': gatewayOrderId,
        'name': 'Play Time',
        'description': description,
        'prefill': {
          'contact': userPhone ?? '',
          'email': userEmail ?? '',
          'name': userName,
        },
        'theme': {'color': '#0DF259'},
      });
    } on BackendFunctionException catch (error) {
      onError(error.message);
    } catch (_) {
      onError('Could not start payment. Please try again.');
    }
  }

  static bool _isAuthorized(String userId) =>
      FirebaseAuth.instance.currentUser?.uid == userId;

  static Future<void> processBookingPayment({
    required Booking booking,
    required Venue venue,
    required String userId,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required void Function(String paymentId) onSuccess,
    required void Function(String error) onError,
  }) async {
    if (!_isAuthorized(userId)) {
      onError('Authorization failed. Please log in again.');
      return;
    }
    await _startServerOrder(
      functionName: 'createBookingPaymentOrder',
      request: {'bookingId': booking.id},
      description: 'Booking payment for ${venue.name}',
      userName: userName,
      userEmail: userEmail,
      userPhone: userPhone,
      onSuccess: onSuccess,
      onError: onError,
    );
  }

  static Future<void> processMembershipPayment({
    required String membershipId,
    required String venueId,
    required double amount,
    required String userId,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required void Function(String paymentId) onSuccess,
    required void Function(String error) onError,
  }) async {
    if (!_isAuthorized(userId)) {
      onError('Authorization failed. Please log in again.');
      return;
    }
    await _startServerOrder(
      functionName: 'createMembershipPaymentOrder',
      request: {'membershipId': membershipId},
      description: venueId == 'platform'
          ? 'Play Time Pro membership'
          : 'Venue membership',
      userName: userName,
      userEmail: userEmail,
      userPhone: userPhone,
      onSuccess: onSuccess,
      onError: onError,
    );
  }

  static Future<void> processOrderPayment({
    required String orderId,
    required String venueId,
    required double amount,
    required String userId,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required void Function(String paymentId) onSuccess,
    required void Function(String error) onError,
  }) async {
    if (!_isAuthorized(userId)) {
      onError('Authorization failed. Please log in again.');
      return;
    }
    await _startServerOrder(
      functionName: 'createMarketplacePaymentOrder',
      request: {'orderId': orderId},
      description: 'Marketplace order',
      userName: userName,
      userEmail: userEmail,
      userPhone: userPhone,
      onSuccess: onSuccess,
      onError: onError,
    );
  }

  static Future<void> spendWallet({
    required String sourceType,
    required String sourceId,
    required void Function(String transactionId) onSuccess,
    required void Function(String error) onError,
  }) async {
    try {
      final result = await BackendFunctionClient.post('spendWallet', {
        'sourceType': sourceType,
        'sourceId': sourceId,
      });
      onSuccess(
        result['transactionId']?.toString() ??
            result['paymentId']?.toString() ??
            sourceId,
      );
    } on BackendFunctionException catch (error) {
      onError(error.message);
    } catch (_) {
      onError('Could not complete wallet payment. Please try again.');
    }
  }

  static void dispose() => _razorpay.clear();
}
