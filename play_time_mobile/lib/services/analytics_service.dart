import 'package:firebase_analytics/firebase_analytics.dart';

/// Central place for Firebase Analytics and event logging.
class AnalyticsService {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  static FirebaseAnalytics get instance => _analytics;

  /// Log a screen view (call when a screen becomes visible).
  static Future<void> logScreenView({
    required String screenName,
    String? screenClass,
  }) async {
    try {
      await _analytics.logScreenView(
        screenName: screenName,
        screenClass: screenClass ?? screenName,
      );
    } catch (_) {}
  }

  /// User started the booking flow (selected slot and opened confirm dialog or tapped book).
  static Future<void> logBookingStarted({
    String? venueId,
    String? sport,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'booking_started',
        parameters: {
          if (venueId != null) 'venue_id': venueId,
          if (sport != null) 'sport': sport,
        },
      );
    } catch (_) {}
  }

  /// Booking was created successfully (with or without payment).
  static Future<void> logBookingCompleted({
    String? bookingId,
    String? venueId,
    double? amount,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'booking_completed',
        parameters: {
          if (bookingId != null) 'booking_id': bookingId,
          if (venueId != null) 'venue_id': venueId,
          if (amount != null) 'amount': amount,
        },
      );
    } catch (_) {}
  }

  /// Payment succeeded for a booking.
  static Future<void> logPaymentSuccess({
    String? bookingId,
    double? amount,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'payment_success',
        parameters: {
          if (bookingId != null) 'booking_id': bookingId,
          if (amount != null) 'amount': amount,
        },
      );
    } catch (_) {}
  }

  /// Payment failed (booking may still exist).
  static Future<void> logPaymentFailed({
    String? bookingId,
    String? reason,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'payment_failed',
        parameters: {
          if (bookingId != null) 'booking_id': bookingId,
          if (reason != null) 'reason': reason,
        },
      );
    } catch (_) {}
  }
}
