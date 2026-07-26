class BookingTimePolicy {
  static const int minimumLeadMinutes = 15;

  static DateTime minimumStartTime([DateTime? now]) =>
      (now ?? DateTime.now()).add(const Duration(minutes: minimumLeadMinutes));

  static bool isBookable(DateTime startTime, [DateTime? now]) =>
      !startTime.isBefore(minimumStartTime(now));

  static const String errorMessage =
      'Bookings must be made at least 15 minutes before the slot starts.';
}
