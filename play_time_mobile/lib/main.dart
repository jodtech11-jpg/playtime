import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
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
import 'screens/sport_select_screen.dart';
import 'screens/checkout_screen.dart';
import 'screens/privacy_settings_screen.dart';
import 'screens/language_settings_screen.dart';
import 'screens/help_support_screen.dart';
import 'screens/team_preferences_screen.dart';
import 'screens/match_filters_screen.dart';
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
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // Register background message handler (must be top-level function)
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    // Initialize FCM with router after widget is built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationService.initialize(router: _router);
    });
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
      ],
      child: MaterialApp.router(
        title: 'Play Time',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        routerConfig: _router,
      ),
    );
  }
}

final GoRouter _router = GoRouter(
  initialLocation: '/splash',
  redirect: (context, state) {
    final user = FirebaseAuth.instance.currentUser;
    final isLoginRoute = state.matchedLocation == '/login' || 
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
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
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
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/venue-detail',
      builder: (context, state) {
        final venueId = state.uri.queryParameters['id'] ?? '';
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
      path: '/sport-select',
      builder: (context, state) => const SportSelectScreen(),
    ),
    GoRoute(
      path: '/checkout',
      builder: (context, state) => const CheckoutScreen(),
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
