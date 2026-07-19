/// Centralized user-facing strings for error and empty states.
/// Use these consistently in FirestoreService catch blocks and empty-state widgets.
class AppStrings {
  AppStrings._();

  // Errors
  static const String somethingWentWrong = 'Something went wrong';
  static const String noInternet = 'No internet';
  static const String noInternetBanner =
      'No internet connection. Some features may be unavailable.';
  static const String retry = 'Retry';
  static const String contactSupport = 'Contact support';

  // Empty states
  static const String noBookings = 'No bookings yet';
  static const String noBookingsHint = 'Tap + to quick book a court';
  static const String noCourts = 'No courts available';
  static const String noVenues = 'No venues found';
  static const String venueNotFound = 'Venue not found';
  static const String noTimeSlots = 'No time slots available for this date';
}
