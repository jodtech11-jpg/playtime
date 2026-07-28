import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:app_links/app_links.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/login_screen.dart';
import 'screens/otp_verification_screen.dart';
import 'screens/home_screen.dart';
import 'screens/venue_detail_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/team_up_screen.dart';
import 'screens/social_feed_screen.dart';
import 'screens/marketplace_screen.dart';
import 'screens/map_view_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/membership_screen.dart';
import 'screens/bookings_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/booking_pass_screen.dart';
import 'screens/sport_select_screen.dart';
import 'screens/checkout_screen.dart';
import 'screens/privacy_settings_screen.dart';
import 'screens/language_settings_screen.dart';
import 'screens/help_support_screen.dart';
import 'screens/team_preferences_screen.dart';
import 'screens/match_filters_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/order_detail_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/booking_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/team_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/venue_provider.dart';
import 'providers/product_provider.dart';
import 'providers/feed_provider.dart';
import 'providers/sport_provider.dart';
import 'providers/membership_provider.dart';
import 'providers/location_provider.dart';
import 'providers/language_provider.dart';
import 'providers/connectivity_provider.dart';
import 'providers/engagement_provider.dart';
import 'providers/order_provider.dart';
import 'widgets/offline_banner.dart';
import 'utils/app_link_mapper.dart';
import 'firebase_options.dart';
import 'app_route_observer.dart';

Future<String> _getInitialDeepLinkPath() async {
  try {
    final appLinks = AppLinks();
    final uri = await appLinks.getInitialLink();
    final route = uri == null ? null : AppLinkMapper.routeFor(uri);
    if (route != null) return route;
  } catch (e, st) {
    // Swallowing the error would hide deep-link bugs; record it and fall back
    // to the splash route so the app can still boot.
    debugPrint('Failed to resolve initial deep link: $e');
    unawaited(
      FirebaseCrashlytics.instance.recordError(
        e,
        st,
        reason: 'getInitialDeepLinkPath',
        fatal: false,
      ),
    );
  }
  return '/splash';
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FlutterError.onError = (error) {
    FirebaseCrashlytics.instance.recordFlutterFatalError(error);
  };
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  final initialPath = await _getInitialDeepLinkPath();
  runZonedGuarded(
    () {
      runApp(MyApp(initialLocation: initialPath));
    },
    (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: false);
    },
  );
}

class MyApp extends StatefulWidget {
  final String initialLocation;

  const MyApp({super.key, required this.initialLocation});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final GoRouter _router;
  late final AppLinks _appLinks;
  StreamSubscription<Uri>? _appLinkSubscription;

  @override
  void initState() {
    super.initState();
    _router = _createRouter(widget.initialLocation);
    _appLinks = AppLinks();
    _appLinkSubscription = _appLinks.uriLinkStream.listen(
      (uri) {
        final route = AppLinkMapper.routeFor(uri);
        if (route != null) _router.go(route);
      },
      onError: (Object error, StackTrace stack) {
        debugPrint('Failed to handle app link: $error');
        unawaited(
          FirebaseCrashlytics.instance.recordError(
            error,
            stack,
            reason: 'uriLinkStream',
            fatal: false,
          ),
        );
      },
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationService.initialize(router: _router);
    });
  }

  @override
  void dispose() {
    _appLinkSubscription?.cancel();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => VenueProvider()),
        ChangeNotifierProvider(create: (_) => BookingProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => TeamProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => FeedProvider()),
        ChangeNotifierProvider(create: (_) => MembershipProvider()),
        ChangeNotifierProvider(create: (_) => SportProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        ChangeNotifierProvider(create: (_) => LanguageProvider()),
        ChangeNotifierProvider(create: (_) => ConnectivityProvider()),
        // Keep engagement global by default. Auto-filtering by selectedVenue
        // hid all matches/tournaments on Home after opening any venue card.
        ChangeNotifierProvider(create: (_) => EngagementProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
      ],
      child: OfflineBannerWrapper(
        child: Consumer<LanguageProvider>(
          builder: (context, language, _) => MaterialApp.router(
            title: 'Play Time',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.darkTheme,
            locale: language.currentLocale,
            supportedLocales: LanguageProvider.supportedLocales,
            localeResolutionCallback: (locale, supportedLocales) =>
                supportedLocales.first,
            routerConfig: _router,
          ),
        ),
      ),
    );
  }
}

GoRouter _createRouter(String initialLocation) => GoRouter(
  initialLocation: initialLocation,
  observers: [appRouteObserver],
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.grey),
          const SizedBox(height: 16),
          Text('Page not found', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => context.go('/home'),
            child: const Text('Go Home'),
          ),
        ],
      ),
    ),
  ),
  redirect: (context, state) {
    final user = FirebaseAuth.instance.currentUser;
    final isLoginRoute =
        state.matchedLocation == '/login' ||
        state.matchedLocation == '/splash' ||
        state.matchedLocation == '/onboarding' ||
        state.matchedLocation == '/otp-verification';

    // Allow access to splash, onboarding, login, and OTP verification routes
    if (isLoginRoute) {
      return null;
    }

    // Redirect to login if not authenticated
    if (user == null) {
      return '/login';
    }

    return null;
  },
  routes: [
    GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(
      path: '/otp-verification',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>?;
        return OtpVerificationScreen(
          phoneNumber: extra?['phoneNumber'] ?? '',
          verificationId: extra?['verificationId'] ?? '',
        );
      },
    ),
    GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
    GoRoute(
      path: '/venue-detail',
      builder: (context, state) {
        final venueId = state.uri.queryParameters['id'] ?? '';
        return VenueDetailScreen(venueId: venueId);
      },
    ),
    // Deep link: /venue/:id (e.g. playtime://app/venue/xyz)
    GoRoute(
      path: '/venue/:id',
      builder: (context, state) {
        final venueId = state.pathParameters['id'] ?? '';
        return VenueDetailScreen(venueId: venueId);
      },
    ),
    GoRoute(
      path: '/profile',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      path: '/team-up',
      builder: (context, state) => const TeamUpScreen(),
    ),
    GoRoute(
      path: '/team/:id',
      builder: (context, state) =>
          TeamUpScreen(invitedTeamId: state.pathParameters['id']),
    ),
    GoRoute(
      path: '/social-feed',
      builder: (context, state) => const SocialFeedScreen(),
    ),
    GoRoute(
      path: '/marketplace',
      builder: (context, state) => const MarketplaceScreen(),
    ),
    GoRoute(
      path: '/map-view',
      builder: (context, state) {
        final selectLocation = state.uri.queryParameters['select'] == 'true';
        return MapViewScreen(selectLocation: selectLocation);
      },
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/membership',
      builder: (context, state) => const MembershipScreen(),
    ),
    GoRoute(
      path: '/bookings',
      builder: (context, state) => const BookingsScreen(),
    ),
    GoRoute(
      path: '/favorites',
      builder: (context, state) => const FavoritesScreen(),
    ),
    GoRoute(
      path: '/booking-pass',
      builder: (context, state) {
        final bookingId = state.uri.queryParameters['id'] ?? '';
        return BookingPassScreen(
          bookingId: bookingId.isEmpty ? null : bookingId,
        );
      },
    ),
    // Deep link: /booking/:id (e.g. playtime://app/booking/xyz)
    GoRoute(
      path: '/booking/:id',
      builder: (context, state) {
        final bookingId = state.pathParameters['id'] ?? '';
        return BookingPassScreen(
          bookingId: bookingId.isEmpty ? null : bookingId,
        );
      },
    ),
    GoRoute(
      path: '/sport-select',
      builder: (context, state) => const SportSelectScreen(),
    ),
    GoRoute(
      path: '/checkout',
      builder: (context, state) => const CheckoutScreen(),
    ),
    GoRoute(
      path: '/checkout/success',
      redirect: (context, state) {
        final orderId = state.uri.queryParameters['orderId'] ?? '';
        return orderId.isEmpty
            ? '/orders'
            : '/order/${Uri.encodeComponent(orderId)}';
      },
    ),
    GoRoute(path: '/orders', builder: (context, state) => const OrdersScreen()),
    GoRoute(
      path: '/order/:id',
      builder: (context, state) =>
          OrderDetailScreen(orderId: state.pathParameters['id'] ?? ''),
    ),
    GoRoute(
      path: '/privacy-settings',
      builder: (context, state) => const PrivacySettingsScreen(),
    ),
    GoRoute(
      path: '/language-settings',
      builder: (context, state) => const LanguageSettingsScreen(),
    ),
    GoRoute(
      path: '/help-support',
      builder: (context, state) => const HelpSupportScreen(),
    ),
    GoRoute(
      path: '/team-preferences',
      builder: (context, state) => const TeamPreferencesScreen(),
    ),
    GoRoute(
      path: '/match-filters',
      builder: (context, state) => const MatchFiltersScreen(),
    ),
  ],
);
