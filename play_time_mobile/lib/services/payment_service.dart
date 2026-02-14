import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../models/venue.dart';
import '../models/booking.dart';
import 'firestore_service.dart';

class PaymentService {
  static final Razorpay _razorpay = Razorpay();
  static Function(String)? _onPaymentSuccess;
  static Function(String)? _onPaymentError;

  /// Initialize Razorpay with callbacks
  static void initialize({
    required Function(String paymentId) onSuccess,
    required Function(String error) onError,
  }) {
    _onPaymentSuccess = onSuccess;
    _onPaymentError = onError;
    
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
        errorMessage = error['description'] as String? ?? error['message'] as String? ?? 'Payment failed';
      } else {
        errorMessage = error.toString();
      }
    }
    if (_onPaymentError != null) {
      _onPaymentError!(errorMessage);
    }
  }

  static void _handleExternalWallet(ExternalWalletResponse response) {
    // Handle external wallet selection
    if (_onPaymentError != null) {
      _onPaymentError!('External wallet selected: ${response.walletName}');
    }
  }

  /// Get Razorpay key from venue settings
  static Future<String?> getRazorpayKey(String venueId) async {
    try {
      final venueDoc = await FirebaseFirestore.instance
          .collection('venues')
          .doc(venueId)
          .get();
      
      if (!venueDoc.exists) {
        return null;
      }
      
      final data = venueDoc.data()!;
      final paymentSettings = data['paymentSettings'] as Map<String, dynamic>?;
      final razorpay = paymentSettings?['razorpay'] as Map<String, dynamic>?;
      final apiKey = razorpay?['apiKey'] as String?;
      final enabled = razorpay?['enabled'] as bool? ?? false;
      
      if (enabled && apiKey != null && apiKey.isNotEmpty) {
        return apiKey;
      }
      
      return null;
    } catch (e) {
      print('Error fetching Razorpay key: $e');
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
      // Get Razorpay key from venue
      final razorpayKey = await getRazorpayKey(venue.id);
      if (razorpayKey == null) {
        onError('Razorpay is not configured for this venue. Please contact the venue manager.');
        return;
      }

      // Initialize Razorpay
      initialize(
        onSuccess: (paymentId) async {
          try {
            // Create payment record in Firestore
            await createPaymentRecord(
              type: 'Online',
              direction: 'UserToVenue',
              sourceType: 'Booking',
              sourceId: booking.id,
              userId: userId,
              venueId: venue.id,
              amount: booking.amount,
              paymentMethod: 'Razorpay',
              paymentGateway: 'Razorpay',
              transactionId: paymentId,
              status: 'Completed',
            );

            // Update booking payment status
            await FirestoreService.updateBooking(booking.id, {
              'paymentStatus': 'Paid',
              'paymentTransactionId': paymentId,
              'updatedAt': FieldValue.serverTimestamp(),
            });

            // Create settlement record for venue-to-platform payment
            await _createSettlementAndInvoice(
              venueId: venue.id,
              venueName: venue.name,
              type: 'Booking',
              grossAmount: booking.amount,
              isFirstTimeBooking: booking.isFirstTimeBooking,
            );

            onSuccess(paymentId);
          } catch (e) {
            onError('Payment successful but failed to record. Please contact support. Error: $e');
          }
        },
        onError: onError,
      );

      // Calculate amount in paise (Razorpay uses smallest currency unit)
      final amountInPaise = (booking.amount * 100).toInt();

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
      print('Error creating payment record: $e');
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
      final commRate = (settings['platformCommission'] as num?)?.toDouble() ?? 0.05;
      final baseConvFee = (settings['convenienceFee'] as num?)?.toDouble() ?? 100.0;

      final commission = grossAmount * commRate;
      final convenienceFee = (type == 'Booking' && isFirstTimeBooking) ? baseConvFee : 0.0;
      const gatewayFeeRate = 0.06; // 6% of commission
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
      final dueDate = Timestamp.fromDate(DateTime.now().add(const Duration(days: 7)));
      final invoiceNumber = 'INV-${DateTime.now().millisecondsSinceEpoch}';

      // Create Invoice
      final invoiceRef = await FirebaseFirestore.instance.collection('invoices').add({
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
      print('Error creating settlement/invoice: $e');
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
      // Get Razorpay key from venue
      final razorpayKey = await getRazorpayKey(venueId);
      if (razorpayKey == null) {
        onError('Razorpay is not configured for this venue. Please contact the venue manager.');
        return;
      }

      // Get venue name
      final venueDoc = await FirebaseFirestore.instance
          .collection('venues')
          .doc(venueId)
          .get();
      final venueName = venueDoc.data()?['name'] as String? ?? 'Venue';

      // Initialize Razorpay
      initialize(
        onSuccess: (paymentId) async {
          try {
            // Create payment record
            await createPaymentRecord(
              type: 'Online',
              direction: 'UserToVenue',
              sourceType: 'Membership',
              sourceId: membershipId,
              userId: userId,
              venueId: venueId,
              amount: amount,
              paymentMethod: 'Razorpay',
              paymentGateway: 'Razorpay',
              transactionId: paymentId,
              status: 'Completed',
            );

            // Update membership payment status
            await FirebaseFirestore.instance
                .collection('memberships')
                .doc(membershipId)
                .update({
              'paymentStatus': 'Paid',
              'paymentTransactionId': paymentId,
              'updatedAt': FieldValue.serverTimestamp(),
            });

            // Create settlement (Convenience fee is 0 for memberships as per Admin Panel logic)
            await _createSettlementAndInvoice(
              venueId: venueId,
              venueName: venueName,
              type: 'Membership',
              grossAmount: amount,
            );

            onSuccess(paymentId);
          } catch (e) {
            onError('Payment successful but failed to record. Please contact support. Error: $e');
          }
        },
        onError: onError,
      );

      // Calculate amount in paise
      final amountInPaise = (amount * 100).toInt();

      // Create Razorpay options
      final options = {
        'key': razorpayKey,
        'amount': amountInPaise,
        'name': 'Play Time',
        'description': 'Membership payment for $venueName',
        'prefill': {
          'contact': userPhone ?? '',
          'email': userEmail ?? '',
          'name': userName,
        },
        'notes': {
          'membershipId': membershipId,
          'venueId': venueId,
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
      // Get Razorpay key from venue
      final razorpayKey = await getRazorpayKey(venueId);
      if (razorpayKey == null) {
        onError('Razorpay is not configured for this venue. Please contact the venue manager.');
        return;
      }

      // Get venue name
      final venueDoc = await FirebaseFirestore.instance
          .collection('venues')
          .doc(venueId)
          .get();
      final venueName = venueDoc.data()?['name'] as String? ?? 'Venue';

      // Initialize Razorpay
      initialize(
        onSuccess: (paymentId) async {
          try {
            // Create payment record
            await createPaymentRecord(
              type: 'Online',
              direction: 'UserToVenue',
              sourceType: 'Order',
              sourceId: orderId,
              userId: userId,
              venueId: venueId,
              amount: amount,
              paymentMethod: 'Razorpay',
              paymentGateway: 'Razorpay',
              transactionId: paymentId,
              status: 'Completed',
            );

            // Update order payment status
            await FirebaseFirestore.instance
                .collection('orders')
                .doc(orderId)
                .update({
              'paymentStatus': 'Paid',
              'paymentTransactionId': paymentId,
              'status': 'Confirmed',
              'updatedAt': FieldValue.serverTimestamp(),
            });

            // Create settlement record for marketplace orders
            await _createSettlementAndInvoice(
              venueId: venueId,
              venueName: venueName,
              type: 'Order',
              grossAmount: amount,
            );

            onSuccess(paymentId);
          } catch (e) {
            onError('Payment successful but failed to record. Please contact support. Error: $e');
          }
        },
        onError: onError,
      );

      // Calculate amount in paise
      final amountInPaise = (amount * 100).toInt();

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
        'notes': {
          'orderId': orderId,
          'venueId': venueId,
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

  /// Clean up Razorpay listeners
  static void dispose() {
    _razorpay.clear();
  }
}

