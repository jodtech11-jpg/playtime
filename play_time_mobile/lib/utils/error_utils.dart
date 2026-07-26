/// Maps raw exceptions / Firebase messages to short player-friendly copy.
String friendlyErrorMessage(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  final raw = error.toString();
  final lower = raw.toLowerCase();

  if (lower.contains('permission-denied') ||
      lower.contains('permission_denied') ||
      lower.contains('missing or insufficient permissions')) {
    return 'You do not have permission to do this. Please sign in again.';
  }
  if (lower.contains('network') ||
      lower.contains('unavailable') ||
      lower.contains('socket') ||
      lower.contains('timeout')) {
    return 'Network error. Check your connection and try again.';
  }
  if (lower.contains('unauthenticated') ||
      lower.contains('user not authenticated') ||
      lower.contains('session expired')) {
    return 'Please log in again to continue.';
  }
  if (lower.contains('slot') &&
      (lower.contains('booked') ||
          lower.contains('taken') ||
          lower.contains('overlap'))) {
    return 'That time slot is no longer available. Please pick another.';
  }
  if (lower.contains('razorpay') && lower.contains('not configured')) {
    return 'Online payment is not available for this venue right now.';
  }
  if (lower.contains('out of date')) {
    return 'Details changed. Please refresh and try again.';
  }

  // Strip Flutter/Firebase Exception wrappers when the rest is already readable.
  final cleaned = raw
      .replaceFirst(RegExp(r'^Exception:\s*'), '')
      .replaceFirst(RegExp(r'^Bad state:\s*', caseSensitive: false), '')
      .replaceFirst(RegExp(r'^StateError:\s*', caseSensitive: false), '')
      .replaceFirst(RegExp(r'^\[.*?\]\s*'), '')
      .trim();
  if (cleaned.isNotEmpty &&
      cleaned.length < 120 &&
      !cleaned.contains('Firestore') &&
      !cleaned.contains('PlatformException')) {
    return cleaned;
  }
  return fallback;
}
