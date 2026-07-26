class AppLinkMapper {
  /// HTTPS links are disabled by default. Set APP_LINK_HOST only after the
  /// production domain serves valid Android/iOS association files.
  static const _configuredHttpsHost = String.fromEnvironment('APP_LINK_HOST');
  static const _allowedRoutes = {
    'booking',
    'bookings',
    'checkout',
    'home',
    'marketplace',
    'membership',
    'notifications',
    'order',
    'orders',
    'profile',
    'social-feed',
    'team',
    'team-up',
    'venue',
  };

  static String? routeFor(Uri uri) {
    final isCustomScheme = uri.scheme.toLowerCase() == 'playtime';
    if (isCustomScheme && uri.host.toLowerCase() != 'app') return null;
    if (!isCustomScheme) {
      if (uri.scheme != 'https' ||
          _configuredHttpsHost.isEmpty ||
          uri.host.toLowerCase() != _configuredHttpsHost.toLowerCase()) {
        return null;
      }
    }

    final segments = uri.pathSegments
        .where((segment) => segment.trim().isNotEmpty)
        .toList();
    if (segments.isEmpty) return '/home';
    if (!_allowedRoutes.contains(segments.first)) return null;

    final path = '/${segments.map(Uri.encodeComponent).join('/')}';
    return uri.hasQuery ? '$path?${uri.query}' : path;
  }
}
