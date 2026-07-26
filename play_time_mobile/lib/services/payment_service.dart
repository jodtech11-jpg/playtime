import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../models/venue.dart';
import '../models/booking.dart';
import 'firestore_service.dart';

class PaymentService {
  static final Razorpay _razorpay = Razorpay();
  static Function(String)? _onPaymentSuccess;
  static Function(String)? _onPaymentError;

  static bool _amountsMatch(double a, double b) => (a - b).abs() < 0.01;

  /// Razorpay "Key ID" is intended for client-side checkout (like a Stripe publishable key).
  /// Never ship the Razorpay **secret** or webhook secret in the app — use Cloud Functions only.

  static Future<double?> _bookingAmountFromServer(String bookingId) async {
    final doc = await FirebaseFirestore.instance
        .collection('bookings')
        .doc(bookingId)
        .get();
    if (!doc.exists) return null;
    return (doc.data()?['amount'] as num?)?.toDouble();
  }

  static Future<double?> _membershipAmountFromServer(
    String membershipId,
  ) async {
    final doc = await FirebaseFirestore.instance
        .collection('memberships')
        .doc(membershipId)
        .get();
    if (!doc.exists) return null;
    final data = doc.data();
    final price = data?['price'] as num?;
    final amount = data?['amount'] as num?;
    if (price != null) return price.toDouble();
    if (amount != null) return amount.toDouble();
    return null;
  }

  static Future<double?> _orderAmountFromServer(String orderId) async {
    final doc = await FirebaseFirestore.instance
        .collection('orders')
        .doc(orderId)
        .get();
    if (!doc.exists) return null;
    return (doc.data()?['total'] as num?)?.toDouble();
  }

  static Future<String?> _orderVenueFromServer(String orderId) async {
    final doc = await FirebaseFirestore.instance
        .collection('orders')
        .doc(orderId)
        .get();
    if (!doc.exists) return null;
    return doc.data()?['venueId'] as String?;
  }

  /// Initialize Razorpay with callbacks
  static void initialize({
    required Function(String paymentId) onSuccess,
    required Function(String error) onError,
  }) {
    _onPaymentSuccess = onSuccess;
    _onPaymentError = onError;

    // Clear any previously registered listeners before re-registering
    // to prevent duplicate callbacks when initialize() is called multiple times.
    _razorpay.clear();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  static void _handlePaymentSuccess(PaymentSuccessResponse response) {
    if (_onPaymentSuccess != null) {
      _onPaymentSuccess!(response.paymentId!);
    }
  }

  static void _handlePaymentError(PaymentFailureResponse response) {
    String errorMessage = 'Payment failed';
    if (response.message != null) {
      errorMessage = response.message!;
    } else if (response.error != null) {
      final error = response.error;
      if (error is Map) {
        errorMessage =
            error['description'] as String? ??
            error['message'] as String? ??
            'Payment failed';
      } else {
        errorMessage = error.toString();
      }
    }
    if (_onPaymentError != null) {
      _onPaymentError!(errorMessage);
    }
  }

  static void _handleExternalWallet(ExternalWalletResponse response) {
    // Wallet selection is not a failure — success/error events follow separately.
    debugPrint('External wallet selected: ${response.walletName}');
  }

  static Future<String?> _platformRazorpayKey() async {
    try {
      final publicDoc = await FirebaseFirestore.instance
          .collection('appSettings')
          .doc('public')
          .get();

      if (publicDoc.exists) {
        final publicData = publicDoc.data() ?? {};
        final integrations =
            publicData['integrations'] as Map<String, dynamic>?;
        final publicRazorpay =
            integrations?['razorpay'] as Map<String, dynamic>?;
        final publicApiKey = publicRazorpay?['apiKey'] as String?;
        if (publicApiKey != null && publicApiKey.isNotEmpty) {
          return publicApiKey;
        }
      }

      try {
        final platformDoc = await FirebaseFirestore.instance
            .collection('appSettings')
            .doc('platform')
            .get();
        if (platformDoc.exists) {
          final integrations =
              platformDoc.data()?['integrations'] as Map<String, dynamic>?;
          final platformRazorpay =
              integrations?['razorpay'] as Map<String, dynamic>?;
          final key = platformRazorpay?['apiKey'] as String?;
          if (key != null && key.isNotEmpty) return key;
        }
      } on FirebaseException catch (e) {
        if (e.code != 'permission-denied') rethrow;
      }
    } catch (e) {
      debugPrint('Error fetching platform Razorpay key: $e');
    }
    return null;
  }

  /// Get Razorpay **Key ID** for checkout (safe to embed in the client; never ship the API **secret**).
  /// Venues store only razorpay.enabled; key comes from venue legacy field or appSettings/integrations/razorpay.
  /// Pass `platform` (or empty) for Play Time Pro / platform checkout.
  static Future<String?> getRazorpayKey(String venueId) async {
    try {
      final normalizedVenueId = venueId.trim();
      if (normalizedVenueId.isEmpty || normalizedVenueId == 'platform') {
        return _platformRazorpayKey();
      }

      // 1. Check if venue has Razorpay enabled
      final venueDoc = await FirebaseFirestore.instance
          .collection('venues')
          .doc(normalizedVenueId)
          .get();

      if (!venueDoc.exists) {
        return null;
      }

      final data = venueDoc.data() ?? {};
      final paymentSettings = data['paymentSettings'] as Map<String, dynamic>?;
      final razorpay = paymentSettings?['razorpay'] as Map<String, dynamic>?;
      final enabled = razorpay?['enabled'] as bool? ?? false;

      if (!enabled) {
        return null;
      }

      // 2. Venue may have its own apiKey (legacy) or use platform key
      final venueApiKey = razorpay?['apiKey'] as String?;
      if (venueApiKey != null && venueApiKey.isNotEmpty) {
        return venueApiKey;
      }

      // 3. Fall back to platform public key
      return _platformRazorpayKey();
    } catch (e) {
      debugPrint('Error fetching Razorpay key: $e');
      return null;
    }
  }

  /// Process booking payment
  static Future<void> processBookingPayment({
    required Booking booking,
    required Venue venue,
    required String userId,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required Function(String paymentId) onSuccess,
    required Function(String error) onError,
  }) async {
    try {
      // Authorization check — userId must match the authenticated user
      final currentUser = FirebaseAuth.instance.currentUser;
      if (currentUser == null || currentUser.uid != userId) {
        onError('Authorization failed. Please log in again.');
        return;
      }

      // Get Razorpay key from venue
      final razorpayKey = await getRazorpayKey(venue.id);
      if (razorpayKey == null) {
        onError(
          'Razorpay is not configured for this venue. Please contact the venue manager.',
        );
        return;
      }

      final serverBookingAmount = await _bookingAmountFromServer(booking.id);
      if (serverBookingAmount == null) {
        onError('Booking not found. Please refresh and try again.');
        return;
      }
      if (!_amountsMatch(serverBookingAmount, booking.amount)) {
        onError('Booking amount is out of date. Please refresh and try again.');
        return;
      }

      // Initialize Razorpay
      initialize(
        onSuccess: (paymentId) async {
          try {
            final verifiedAmount = await _bookingAmountFromServer(booking.id);
            if (verifiedAmount == null ||
                !_amountsMatch(verifiedAmount, serverBookingAmount)) {
              onError(
                'Could not verify payment amount. If charged, contact support with your receipt.',
              );
              return;
            }
            // Idempotency check — scoped to this user so Firestore rules allow the query
            final existing = await FirebaseFirestore.instance
                .collection('payments')
                .where('userId', isEqualTo: userId)
                .where('transactionId', isEqualTo: paymentId)
                .limit(1)
                .get();
            if (existing.docs.isNotEmpty) {
              onSuccess(paymentId);
              return;
            }

            // Atomic batch: payment record + booking status update
            final batch = FirebaseFirestore.instance.batch();
            final paymentRef = FirebaseFirestore.instance
                .collection('payments')
                .doc();
            batch.set(paymentRef, {
              'type': 'Online',
              'direction': 'UserToVenue',
              'sourceType': 'Booking',
              'sourceId': booking.id,
              'userId': userId,
              'venueId': venue.id,
              'amount': verifiedAmount,
              'paymentMethod': 'Razorpay',
              'paymentGateway': 'Razorpay',
              'transactionId': paymentId,
              'status': 'Completed',
              'paymentDate': FieldValue.serverTimestamp(),
              'createdAt': FieldValue.serverTimestamp(),
              'updatedAt': FieldValue.serverTimestamp(),
            });
            final bookingRef = FirebaseFirestore.instance
                .collection('bookings')
                .doc(booking.id);
            batch.update(bookingRef, {
              'status': 'Confirmed',
              'paymentStatus': 'Paid',
              'paymentTransactionId': paymentId,
              'updatedAt': FieldValue.serverTimestamp(),
            });
            await batch.commit();

            // Settlement is best-effort (admin-side); does not fail user flow
            try {
              await _createSettlementAndInvoice(
                venueId: venue.id,
                venueName: venue.name,
                type: 'Booking',
                grossAmount: verifiedAmount,
                isFirstTimeBooking: booking.isFirstTimeBooking,
              );
            } catch (e) {
              debugPrint(
                'Settlement creation failed for booking ${booking.id}: $e',
              );
            }

            onSuccess(paymentId);
          } catch (e) {
            onError(
              'Payment successful but failed to record. Please contact support. Error: $e',
            );
          }
        },
        onError: onError,
      );

      // Calculate amount in paise (Razorpay uses smallest currency unit) — server-verified amount
      final amountInPaise = (serverBookingAmount * 100).toInt();

      // Create Razorpay options
      final options = {
        'key': razorpayKey,
        'amount': amountInPaise,
        'name': 'Play Time',
        'description': 'Booking payment for ${venue.name}',
        'prefill': {
          'contact': userPhone ?? '',
          'email': userEmail ?? '',
          'name': userName,
        },
        'notes': {
          'bookingId': booking.id,
          'venueId': venue.id,
          'userId': userId,
        },
        'theme': {'color': '#0DF259'},
      };

      // Open Razorpay checkout
      _razorpay.open(options);
    } catch (e) {
      onError('Failed to initiate payment: $e');
    }
  }

  /// Create payment record in Firestore
  static Future<void> createPaymentRecord({
    required String type,
    required String direction,
    required String sourceType,
    required String sourceId,
    required String venueId,
    required double amount,
    required String paymentMethod,
    String? userId,
    String? paymentGateway,
    String? transactionId,
    String status = 'Completed',
  }) async {
    try {
      await FirebaseFirestore.instance.collection('payments').add({
        'type': type,
        'direction': direction,
        'sourceType': sourceType,
        'sourceId': sourceId,
        'userId': userId,
        'venueId': venueId,
        'amount': amount,
        'paymentMethod': paymentMethod,
        'paymentGateway': paymentGateway,
        'transactionId': transactionId,
        'status': status,
        'paymentDate': FieldValue.serverTimestamp(),
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error creating payment record: $e');
      rethrow;
    }
  }

  /// Private helper to create invoice and settlement records
  static Future<void> _createSettlementAndInvoice({
    required String venueId,
    required String venueName,
    required String type, // 'Booking' | 'Membership' | 'Order'
    required double grossAmount,
    bool isFirstTimeBooking = false,
  }) async {
    try {
      // Fetch dynamic settings from Firestore
      final settings = await FirestoreService.getPlatformSettings();
      final commRate =
          (settings['platformCommission'] as num?)?.toDouble() ?? 0.05;
      final baseConvFee =
          (settings['convenienceFee'] as num?)?.toDouble() ?? 100.0;

      final gatewayFeeRate =
          (settings['gatewayFeeRate'] as num?)?.toDouble() ?? 0.06;
      final commission = grossAmount * commRate;
      final convenienceFee = (type == 'Booking' && isFirstTimeBooking)
          ? baseConvFee
          : 0.0;
      final gatewayFee = commission * gatewayFeeRate;
      final totalSettlementAmount = commission + convenienceFee - gatewayFee;

      final breakdown = {
        'gross': grossAmount,
        'commission': commission,
        'convenienceFee': convenienceFee,
        'gatewayFee': gatewayFee,
        'net': totalSettlementAmount,
      };

      final timestamp = FieldValue.serverTimestamp();
      final dueDate = Timestamp.fromDate(
        DateTime.now().add(const Duration(days: 7)),
      );
      final invoiceNumber =
          'INV-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(9999).toString().padLeft(4, '0')}';

      // Create Invoice
      final invoiceRef = await FirebaseFirestore.instance
          .collection('invoices')
          .add({
            'invoiceNumber': invoiceNumber,
            'venueId': venueId,
            'venueName': venueName,
            'type': type,
            'amount': totalSettlementAmount,
            'breakdown': breakdown,
            'status': 'Sent',
            'dueDate': dueDate,
            'createdAt': timestamp,
            'updatedAt': timestamp,
          });

      // Create Settlement
      await FirebaseFirestore.instance.collection('settlements').add({
        'venueId': venueId,
        'venueName': venueName,
        'invoiceId': invoiceRef.id,
        'invoiceNumber': invoiceNumber,
        'amount': totalSettlementAmount,
        'breakdown': breakdown,
        'status': 'Pending',
        'dueDate': dueDate,
        'createdAt': timestamp,
        'updatedAt': timestamp,
      });
    } catch (e) {
      debugPrint('Error creating settlement/invoice: $e');
    }
  }

  /// Process membership payment
  static Future<void> processMembershipPayment({
    required String membershipId,
    required String venueId,
    required double amount,
    required String userId,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required Function(String paymentId) onSuccess,
    required Function(String error) onError,
  }) async {
    try {
      // Authorization check
      final currentUser = FirebaseAuth.instance.currentUser;
      if (currentUser == null || currentUser.uid != userId) {
        onError('Authorization failed. Please log in again.');
        return;
      }

      final isPlatformMembership =
          venueId.trim().isEmpty || venueId.trim() == 'platform';

      final razorpayKey = await getRazorpayKey(venueId);
      if (razorpayKey == null) {
        onError(
          isPlatformMembership
              ? 'Razorpay is not configured. Please try again later.'
              : 'Razorpay is not configured for this venue. Please contact the venue manager.',
        );
        return;
      }

      String venueName = 'Play Time Pro';
      if (!isPlatformMembership) {
        final venueDoc = await FirebaseFirestore.instance
            .collection('venues')
            .doc(venueId)
            .get();
        venueName = venueDoc.data()?['name'] as String? ?? 'Venue';
      }

      final serverMembershipAmount = await _membershipAmountFromServer(
        membershipId,
      );
      if (serverMembershipAmount == null) {
        onError('Membership not found. Please refresh and try again.');
        return;
      }
      if (!_amountsMatch(serverMembershipAmount, amount)) {
        onError(
          'Membership amount is out of date. Please refresh and try again.',
        );
        return;
      }

      // Initialize Razorpay
      initialize(
        onSuccess: (paymentId) async {
          try {
            final verifiedAmount = await _membershipAmountFromServer(
              membershipId,
            );
            if (verifiedAmount == null ||
                !_amountsMatch(verifiedAmount, serverMembershipAmount)) {
              onError(
                'Could not verify payment amount. If charged, contact support with your receipt.',
              );
              return;
            }
            // Idempotency — scoped to user so Firestore rules allow the query
            final existing = await FirebaseFirestore.instance
                .collection('payments')
                .where('userId', isEqualTo: userId)
                .where('transactionId', isEqualTo: paymentId)
                .limit(1)
                .get();
            if (existing.docs.isNotEmpty) {
              onSuccess(paymentId);
              return;
            }

            // Atomic batch: payment record + activate membership
            final batch = FirebaseFirestore.instance.batch();
            final paymentRef = FirebaseFirestore.instance
                .collection('payments')
                .doc();
            batch.set(paymentRef, {
              'type': 'Online',
              'direction': isPlatformMembership
                  ? 'UserToPlatform'
                  : 'UserToVenue',
              'sourceType': 'Membership',
              'sourceId': membershipId,
              'userId': userId,
              'venueId': isPlatformMembership ? 'platform' : venueId,
              'amount': verifiedAmount,
              'paymentMethod': 'Razorpay',
              'paymentGateway': 'Razorpay',
              'transactionId': paymentId,
              'status': 'Completed',
              'paymentDate': FieldValue.serverTimestamp(),
              'createdAt': FieldValue.serverTimestamp(),
              'updatedAt': FieldValue.serverTimestamp(),
            });
            final membershipRef = FirebaseFirestore.instance
                .collection('memberships')
                .doc(membershipId);
            batch.update(membershipRef, {
              'status': 'Active',
              'paymentStatus': 'Paid',
              'paymentMethod': 'Online',
              'paymentGateway': 'Razorpay',
              'paymentTransactionId': paymentId,
              'paymentDate': FieldValue.serverTimestamp(),
              'updatedAt': FieldValue.serverTimestamp(),
            });
            await batch.commit();

            // Settlement is best-effort (venue subscriptions only)
            if (!isPlatformMembership) {
              try {
                await _createSettlementAndInvoice(
                  venueId: venueId,
                  venueName: venueName,
                  type: 'Membership',
                  grossAmount: verifiedAmount,
                );
              } catch (e) {
                debugPrint(
                  'Settlement creation failed for membership $membershipId: $e',
                );
              }
            }

            onSuccess(paymentId);
          } catch (e) {
            onError(
              'Payment successful but failed to record. Please contact support. Error: $e',
            );
          }
        },
        onError: onError,
      );

      final amountInPaise = (serverMembershipAmount * 100).toInt();

      final options = {
        'key': razorpayKey,
        'amount': amountInPaise,
        'name': 'Play Time',
        'description': isPlatformMembership
            ? 'Play Time Pro membership'
            : 'Subscription payment for $venueName',
        'prefill': {
          'contact': userPhone ?? '',
          'email': userEmail ?? '',
          'name': userName,
        },
        'notes': {
          'membershipId': membershipId,
          'venueId': isPlatformMembership ? 'platform' : venueId,
          'userId': userId,
        },
        'theme': {'color': '#0DF259'},
      };

      _razorpay.open(options);
    } catch (e) {
      onError('Failed to initiate payment: $e');
    }
  }

  /// Process marketplace order payment
  static Future<void> processOrderPayment({
    required String orderId,
    required String venueId,
    required double amount,
    required String userId,
    required String userName,
    required String? userEmail,
    required String? userPhone,
    required Function(String paymentId) onSuccess,
    required Function(String error) onError,
  }) async {
    try {
      // Authorization check
      final currentUser = FirebaseAuth.instance.currentUser;
      if (currentUser == null || currentUser.uid != userId) {
        onError('Authorization failed. Please log in again.');
        return;
      }

      // Get Razorpay key from venue
      final razorpayKey = await getRazorpayKey(venueId);
      if (razorpayKey == null) {
        onError(
          'Razorpay is not configured for this venue. Please contact the venue manager.',
        );
        return;
      }

      // Get venue name
      final venueDoc = await FirebaseFirestore.instance
          .collection('venues')
          .doc(venueId)
          .get();
      final venueName = venueDoc.data()?['name'] as String? ?? 'Venue';

      final serverOrderTotal = await _orderAmountFromServer(orderId);
      if (serverOrderTotal == null) {
        onError('Order not found. Please refresh and try again.');
        return;
      }
      if (!_amountsMatch(serverOrderTotal, amount)) {
        onError('Order total is out of date. Please refresh and try again.');
        return;
      }
      final serverVenueId = await _orderVenueFromServer(orderId);
      if (serverVenueId == null || serverVenueId.isEmpty) {
        onError(
          'Order fulfilment venue is missing. Please recreate the order.',
        );
        return;
      }
      if (serverVenueId != venueId) {
        onError(
          'Order venue does not match this payment. Please refresh and try again.',
        );
        return;
      }

      // Initialize Razorpay
      initialize(
        onSuccess: (paymentId) async {
          try {
            final verifiedAmount = await _orderAmountFromServer(orderId);
            if (verifiedAmount == null ||
                !_amountsMatch(verifiedAmount, serverOrderTotal)) {
              onError(
                'Could not verify payment amount. If charged, contact support with your receipt.',
              );
              return;
            }
            // Idempotency — scoped to user so Firestore rules allow the query
            final existing = await FirebaseFirestore.instance
                .collection('payments')
                .where('userId', isEqualTo: userId)
                .where('transactionId', isEqualTo: paymentId)
                .limit(1)
                .get();
            if (existing.docs.isNotEmpty) {
              onSuccess(paymentId);
              return;
            }

            // Atomic batch: payment record + order status update
            final batch = FirebaseFirestore.instance.batch();
            final paymentRef = FirebaseFirestore.instance
                .collection('payments')
                .doc();
            batch.set(paymentRef, {
              'type': 'Online',
              'direction': 'UserToVenue',
              'sourceType': 'Order',
              'sourceId': orderId,
              'userId': userId,
              'venueId': venueId,
              'amount': verifiedAmount,
              'paymentMethod': 'Razorpay',
              'paymentGateway': 'Razorpay',
              'transactionId': paymentId,
              'status': 'Completed',
              'paymentDate': FieldValue.serverTimestamp(),
              'createdAt': FieldValue.serverTimestamp(),
              'updatedAt': FieldValue.serverTimestamp(),
            });
            final orderRef = FirebaseFirestore.instance
                .collection('orders')
                .doc(orderId);
            batch.update(orderRef, {
              'paymentStatus': 'Paid',
              'paymentTransactionId': paymentId,
              'status': 'Processing',
              'updatedAt': FieldValue.serverTimestamp(),
            });
            await batch.commit();

            // Settlement is best-effort
            try {
              await _createSettlementAndInvoice(
                venueId: venueId,
                venueName: venueName,
                type: 'Order',
                grossAmount: verifiedAmount,
              );
            } catch (e) {
              debugPrint('Settlement creation failed for order $orderId: $e');
            }

            onSuccess(paymentId);
          } catch (e) {
            onError(
              'Payment successful but failed to record. Please contact support. Error: $e',
            );
          }
        },
        onError: onError,
      );

      // Calculate amount in paise
      final amountInPaise = (serverOrderTotal * 100).toInt();

      // Create Razorpay options
      final options = {
        'key': razorpayKey,
        'amount': amountInPaise,
        'name': 'Play Time',
        'description': 'Order payment for $venueName',
        'prefill': {
          'contact': userPhone ?? '',
          'email': userEmail ?? '',
          'name': userName,
        },
        'notes': {'orderId': orderId, 'venueId': venueId, 'userId': userId},
        'theme': {'color': '#0DF259'},
      };

      // Open Razorpay checkout
      _razorpay.open(options);
    } catch (e) {
      onError('Failed to initiate payment: $e');
    }
  }

  /// Clean up Razorpay listeners
  static void dispose() {
    _razorpay.clear();
  }
}
