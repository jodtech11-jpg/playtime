import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../theme/app_colors.dart';
import '../models/venue.dart';
import '../widgets/bottom_nav.dart';
import '../providers/venue_provider.dart';
import '../providers/location_provider.dart';
import '../providers/sport_provider.dart';
import '../providers/engagement_provider.dart';
import '../providers/booking_provider.dart';
import '../providers/notification_provider.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../widgets/shimmer_box.dart';
import '../services/firestore_service.dart';
import '../services/analytics_service.dart';
import '../services/notification_service.dart';
import '../app_route_observer.dart';
import '../widgets/home/for_you_section.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with RouteAware {
  String _activeCategory = 'All';
  final TextEditingController _searchController = TextEditingController();
  bool _isFilterOpen = false;
  double _maxPrice = 1500;
  List<String> _selectedAmenities = [];
  String? _selectedSport = 'All';
  String _sortBy = 'rating'; // Default sort by rating
  String? _userName;
  Map<String, dynamic>? _userProfile;
  Set<String> _favoriteVenueIds = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) {
      appRouteObserver.subscribe(this, route);
    }
  }

  @override
  void didPopNext() {
    _searchController.clear();
    setState(() {});
  }

  @override
  void initState() {
    super.initState();
    AnalyticsService.logScreenView(
      screenName: 'home',
      screenClass: 'HomeScreen',
    );
    _loadUserData();
    _loadFavorites();
    // Add listener to search controller to trigger rebuilds
    _searchController.addListener(() {
      setState(() {});
    });
  }

  Future<void> _loadUserData() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final profile = await FirestoreService.getUserProfile(user.uid);
      if (mounted) {
        setState(() {
          _userProfile = profile;
          _userName =
              user.displayName ??
              profile?['name'] ??
              user.email?.split('@').first ??
              'Player';
        });
      }
    }
  }

  Future<void> _loadFavorites() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      try {
        final favorites = await FirestoreService.getUserFavorites(user.uid);
        if (mounted) {
          setState(() {
            _favoriteVenueIds = favorites.toSet();
          });
        }
      } catch (e) {
        debugPrint('Error loading favorites: $e');
      }
    }
  }

  Future<void> _toggleFavorite(String venueId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please login to add favorites'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    try {
      final isFavorited = _favoriteVenueIds.contains(venueId);
      if (mounted) {
        setState(() {
          if (isFavorited) {
            _favoriteVenueIds.remove(venueId);
          } else {
            _favoriteVenueIds.add(venueId);
          }
        });
      }

      await FirestoreService.toggleFavoriteVenue(user.uid, venueId);
      // Subscribe to venue match/tournament alerts when favorited
      try {
        if (isFavorited) {
          await NotificationService.unsubscribeFromTopic(
            'venue_${venueId.replaceAll(RegExp(r'[^a-zA-Z0-9\-_.~%]'), '_')}',
          );
        } else {
          await NotificationService.subscribeToTopic(
            'venue_${venueId.replaceAll(RegExp(r'[^a-zA-Z0-9\-_.~%]'), '_')}',
          );
        }
      } catch (e) {
        debugPrint('FCM topic update failed: $e');
      }
    } catch (e) {
      await _loadFavorites();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update favorite: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    _searchController.dispose();
    super.dispose();
  }

  void _navigateToVenueDetail(String venueId) {
    context.push('/venue-detail?id=$venueId');
  }

  IconData _getSportIcon(String sportName) {
    switch (sportName.toLowerCase()) {
      case 'cricket':
        return Icons.sports_cricket;
      case 'football':
        return Icons.sports_soccer;
      case 'badminton':
        return Icons.sports_tennis;
      case 'tennis':
        return Icons.sports_tennis;
      case 'swimming':
        return Icons.pool;
      case 'basketball':
        return Icons.sports_basketball;
      case 'volleyball':
        return Icons.sports_volleyball;
      case 'hockey':
        return Icons.sports_hockey;
      case 'baseball':
        return Icons.sports_baseball;
      case 'golf':
        return Icons.sports_golf;
      case 'rugby':
        return Icons.sports_rugby;
      default:
        return Icons.sports_esports;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Consumer<LocationProvider>(
                    builder: (context, locationProvider, child) {
                      return GestureDetector(
                        onTap: () async {
                          // Open map view to select location
                          await context.push('/map-view?select=true');
                          // Refresh location after returning
                          await locationProvider.refreshLocation();

                          // Immediately refresh venues with new location
                          if (!context.mounted) return;
                          final venueProvider = Provider.of<VenueProvider>(
                            context,
                            listen: false,
                          );
                          await venueProvider.loadVenues(
                            lat: locationProvider.selectedLat,
                            lng: locationProvider.selectedLng,
                          );
                        },
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.05),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.05),
                                ),
                              ),
                              child: const Icon(
                                Icons.location_on,
                                color: AppColors.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'PLAY AT',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.35,
                                  ),
                                ),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    ConstrainedBox(
                                      constraints: BoxConstraints(
                                        maxWidth:
                                            MediaQuery.of(context).size.width *
                                            0.4,
                                      ),
                                      child: Text(
                                        locationProvider.displayLocation,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w900,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Icon(
                                      Icons.expand_more,
                                      color: AppColors.primary,
                                      size: 16,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const Spacer(),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: () => context.push('/notifications'),
                    icon: Stack(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.05),
                            ),
                          ),
                          child: const Icon(
                            Icons.notifications,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                        if (context.watch<NotificationProvider>().unreadCount >
                            0)
                          Positioned(
                            top: 6,
                            right: 6,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Content
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  final venueProvider = Provider.of<VenueProvider>(
                    context,
                    listen: false,
                  );
                  await Future.wait([
                    venueProvider.loadVenues(),
                    context.read<EngagementProvider>().refresh(),
                    context.read<BookingProvider>().pullToRefresh(),
                  ]);
                },
                color: AppColors.primary,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Welcome Section
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ready to Play,\n${_userName ?? 'Player'}?',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 32,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -1,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 16),
                            // Progress Bar Module
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceDark,
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.05),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.1,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: AppColors.primary.withValues(
                                          alpha: 0.2,
                                        ),
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.military_tech,
                                      color: AppColors.primary,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          'LEVEL ${_userProfile?['level'] ?? 1}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.35,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        LinearProgressIndicator(
                                          value: () {
                                            final progress =
                                                _userProfile?['progress'];
                                            if (progress == null) return 0.0;
                                            if (progress is double) {
                                              return progress;
                                            }
                                            if (progress is int) {
                                              return progress.toDouble();
                                            }
                                            if (progress is num) {
                                              return progress.toDouble();
                                            }
                                            return 0.0;
                                          }(),
                                          backgroundColor: Colors.white10,
                                          valueColor:
                                              const AlwaysStoppedAnimation<
                                                Color
                                              >(AppColors.primary),
                                          minHeight: 6,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Container(
                                    width: 1,
                                    height: 32,
                                    color: Colors.white.withValues(alpha: 0.05),
                                  ),
                                  const SizedBox(width: 12),
                                  Column(
                                    children: [
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.local_fire_department,
                                            color: Colors.orange,
                                            size: 16,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            '${_userProfile?['streak'] ?? 0} Day Streak',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 14,
                                              fontWeight: FontWeight.w900,
                                            ),
                                          ),
                                        ],
                                      ),
                                      SizedBox(height: 4),
                                      Text(
                                        '+20 XP TOMORROW',
                                        style: TextStyle(
                                          color: Colors.grey,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.25,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            // Quick Access Cards - Membership & Marketplace
                            IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => context.push('/membership'),
                                      child: Container(
                                        padding: const EdgeInsets.all(16),
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              AppColors.primary.withValues(
                                                alpha: 0.2,
                                              ),
                                              AppColors.primary.withValues(
                                                alpha: 0.1,
                                              ),
                                            ],
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            20,
                                          ),
                                          border: Border.all(
                                            color: AppColors.primary.withValues(
                                              alpha: 0.3,
                                            ),
                                            width: 1,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 44,
                                              height: 44,
                                              decoration: BoxDecoration(
                                                color: AppColors.primary
                                                    .withValues(alpha: 0.2),
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                              ),
                                              child: const Icon(
                                                Icons.stars,
                                                color: AppColors.primary,
                                                size: 22,
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Text(
                                                    'Pro Membership',
                                                    style: TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                      height: 1.1,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    'Unlock benefits',
                                                    style: TextStyle(
                                                      color: Colors.grey[400],
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Icon(
                                              Icons.arrow_forward_ios,
                                              color: AppColors.primary,
                                              size: 14,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => context.push('/marketplace'),
                                      child: Container(
                                        padding: const EdgeInsets.all(16),
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              Colors.purple.withValues(
                                                alpha: 0.2,
                                              ),
                                              Colors.purple.withValues(
                                                alpha: 0.1,
                                              ),
                                            ],
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            20,
                                          ),
                                          border: Border.all(
                                            color: Colors.purple.withValues(
                                              alpha: 0.3,
                                            ),
                                            width: 1,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 44,
                                              height: 44,
                                              decoration: BoxDecoration(
                                                color: Colors.purple.withValues(
                                                  alpha: 0.2,
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                              ),
                                              child: const Icon(
                                                Icons.shopping_bag,
                                                color: Colors.purple,
                                                size: 22,
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Text(
                                                    'Marketplace',
                                                    style: TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                      height: 1.1,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    'Shop gear',
                                                    style: TextStyle(
                                                      color: Colors.grey[400],
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Icon(
                                              Icons.arrow_forward_ios,
                                              color: Colors.purple,
                                              size: 14,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Search & Categories
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    height: 56,
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceDark,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: TextField(
                                      controller: _searchController,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                      ),
                                      decoration: InputDecoration(
                                        hintText:
                                            'Search turfs or tournaments...',
                                        hintStyle: TextStyle(
                                          color: Colors.grey[600],
                                        ),
                                        prefixIcon: Icon(
                                          Icons.search,
                                          color: Colors.grey[500],
                                        ),
                                        border: InputBorder.none,
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 16,
                                              vertical: 16,
                                            ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                GestureDetector(
                                  onTap: _showFilterModal,
                                  child: Container(
                                    width: 56,
                                    height: 56,
                                    decoration: BoxDecoration(
                                      color:
                                          (_isFilterOpen ||
                                              _selectedAmenities.isNotEmpty ||
                                              _maxPrice < 1500 ||
                                              (_selectedSport != null &&
                                                  _selectedSport != 'All'))
                                          ? AppColors.primary
                                          : AppColors.surfaceDark,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: Colors.white.withValues(
                                          alpha: 0.05,
                                        ),
                                      ),
                                    ),
                                    child: Icon(
                                      Icons.tune,
                                      color:
                                          (_isFilterOpen ||
                                              _selectedAmenities.isNotEmpty ||
                                              _maxPrice < 1500 ||
                                              (_selectedSport != null &&
                                                  _selectedSport != 'All'))
                                          ? AppColors.backgroundDark
                                          : Colors.grey,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              height: 50,
                              child: Consumer<SportProvider>(
                                builder: (context, sportProvider, child) {
                                  final sports = sportProvider.sports;
                                  final categories = [
                                    {'name': 'All', 'icon': Icons.apps},
                                    ...sports.map(
                                      (sport) => {
                                        'name': sport.name,
                                        'icon': _getSportIcon(sport.name),
                                      },
                                    ),
                                  ];

                                  return ListView.builder(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: categories.length,
                                    itemBuilder: (context, index) {
                                      final category = categories[index];
                                      final isActive =
                                          _activeCategory == category['name'];
                                      return Padding(
                                        padding: const EdgeInsets.only(
                                          right: 12,
                                        ),
                                        child: ElevatedButton.icon(
                                          onPressed: () {
                                            setState(() {
                                              _activeCategory =
                                                  category['name'] as String;
                                            });
                                          },
                                          icon: Icon(
                                            category['icon'] as IconData,
                                            size: 20,
                                          ),
                                          label: Text(
                                            category['name'] as String,
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 0.25,
                                            ),
                                          ),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: isActive
                                                ? AppColors.primary
                                                : AppColors.surfaceDark,
                                            foregroundColor: isActive
                                                ? AppColors.backgroundDark
                                                : Colors.white.withValues(
                                                    alpha: 0.8,
                                                  ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 24,
                                              vertical: 12,
                                            ),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(16),
                                              side: BorderSide(
                                                color: isActive
                                                    ? AppColors.primary
                                                    : Colors.white.withValues(
                                                        alpha: 0.05,
                                                      ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      // Upcoming matches / tournaments / offers
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Consumer2<EngagementProvider, BookingProvider>(
                          builder: (context, engagement, bookings, _) {
                            final upcomingBookings = bookings
                                .getUpcomingBookings()
                                .take(2)
                                .toList();
                            final items = <ForYouItem>[
                              ...upcomingBookings.map(
                                (booking) => ForYouItem(
                                  category: 'Up next',
                                  title: booking.courtName?.isNotEmpty == true
                                      ? booking.courtName!
                                      : (booking.sport.isNotEmpty
                                            ? booking.sport
                                            : 'Court booking'),
                                  subtitle:
                                      '${booking.venueName} • ${booking.date} ${booking.time}',
                                  meta: 'View your booking',
                                  icon: Icons.event_available_rounded,
                                  accent: AppColors.primary,
                                  onTap: () => context.push('/bookings'),
                                ),
                              ),
                              ...engagement.upcomingQuickMatches
                                  .take(3)
                                  .map(
                                    (match) => ForYouItem(
                                      category: 'Open match',
                                      title: match.sport.isNotEmpty
                                          ? match.sport
                                          : 'Quick match',
                                      subtitle:
                                          '${match.venueName ?? 'Venue'} • ${match.time}',
                                      meta:
                                          '${match.currentPlayers}/${match.maxPlayers} players joined',
                                      icon: Icons.groups_rounded,
                                      accent: AppColors.cyan,
                                      onTap: () => context.push('/team-up'),
                                    ),
                                  ),
                              ...engagement.openTournaments
                                  .take(2)
                                  .map(
                                    (tournament) => ForYouItem(
                                      category: 'Tournament',
                                      title: tournament.name,
                                      subtitle:
                                          '${tournament.sport} • ${tournament.venueName ?? 'Venue'}',
                                      meta: tournament.entryFee > 0
                                          ? 'Entry ₹${tournament.entryFee.toInt()}'
                                          : 'Free registration',
                                      icon: Icons.emoji_events_rounded,
                                      accent: AppColors.warning,
                                      onTap: () => context.push('/team-up'),
                                    ),
                                  ),
                              ...engagement.flashDeals
                                  .take(2)
                                  .map(
                                    (deal) => ForYouItem(
                                      category: 'Limited offer',
                                      title: deal.title,
                                      subtitle:
                                          deal.venueName ?? 'Play Time offer',
                                      meta:
                                          'Now ₹${deal.discountedPrice.toInt()}',
                                      icon: Icons.local_offer_rounded,
                                      accent: AppColors.orange,
                                      onTap: () => context.push(
                                        '/venue/${deal.venueId}',
                                      ),
                                    ),
                                  ),
                              ...engagement.campaigns
                                  .take(1)
                                  .map(
                                    (campaign) => ForYouItem(
                                      category: 'Discover',
                                      title: campaign.title,
                                      subtitle:
                                          campaign.description ??
                                          campaign.target,
                                      meta: 'Explore now',
                                      icon: Icons.campaign_rounded,
                                      accent: AppColors.purple,
                                      onTap: () => context.push('/marketplace'),
                                    ),
                                  ),
                            ].take(8).toList();

                            return ForYouSection(
                              items: items,
                              isLoading:
                                  engagement.isLoading || bookings.isLoading,
                              onSeeAll: () => context.push('/team-up'),
                              onExploreVenues: () => context.push('/map-view'),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 24),
                      // Nearby Venues Section
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Nearby Arenas',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                GestureDetector(
                                  onTap: _showSortOptions,
                                  child: Row(
                                    children: [
                                      Text(
                                        _getSortLabel(_sortBy),
                                        style: TextStyle(
                                          color: Colors.grey[500],
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.25,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(
                                        Icons.expand_more,
                                        color: Colors.grey[500],
                                        size: 14,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Consumer<VenueProvider>(
                              builder: (context, venueProvider, child) {
                                if (venueProvider.isLoading) {
                                  return ListView.separated(
                                    shrinkWrap: true,
                                    physics:
                                        const NeverScrollableScrollPhysics(),
                                    itemCount: 4,
                                    separatorBuilder: (_, _) =>
                                        const SizedBox(height: 12),
                                    itemBuilder: (_, _) =>
                                        const ShimmerVenueCard(),
                                  );
                                }

                                if (venueProvider.error != null) {
                                  return ErrorDisplayWidget(
                                    message: venueProvider.error!,
                                    onRetry: () => venueProvider.loadVenues(),
                                  );
                                }

                                // Apply filters
                                final searchQuery = _searchController.text
                                    .trim();
                                // Use filter modal sport selection if set, otherwise use category selection
                                final sportFilter =
                                    _selectedSport != null &&
                                        _selectedSport != 'All'
                                    ? _selectedSport
                                    : (_activeCategory == 'All'
                                          ? null
                                          : _activeCategory);
                                // Apply maxPrice filter if it's less than the default max (1500)
                                // or if user explicitly set it to a value
                                final maxPriceFilter = _maxPrice < 1500
                                    ? _maxPrice
                                    : null;
                                final filteredVenues = venueProvider
                                    .getFilteredVenues(
                                      searchQuery: searchQuery.isNotEmpty
                                          ? searchQuery
                                          : null,
                                      maxPrice: maxPriceFilter,
                                      amenities: _selectedAmenities.isNotEmpty
                                          ? _selectedAmenities
                                          : null,
                                      sport: sportFilter,
                                      sortBy: _sortBy,
                                    );

                                final venues = filteredVenues;

                                if (venues.isEmpty) {
                                  return EmptyStateWidget(
                                    icon: Icons.location_off,
                                    title: 'No venues found',
                                    message:
                                        'Try adjusting your filters or search query',
                                  );
                                }

                                return ListView.builder(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  itemCount: venues.length,
                                  itemBuilder: (context, index) {
                                    final venue = venues[index];
                                    return _buildVenueCard(venue);
                                  },
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),
                      // Map Button (Moved from persistentFooterButtons)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/map-view'),
                          icon: const Icon(Icons.map, size: 20),
                          label: const Text(
                            'EXPLORE MAP',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.35,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.backgroundDark,
                            minimumSize: const Size(double.infinity, 56),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(
                        height: 100,
                      ), // Space for FAB and bottom nav
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const BottomNav(currentIndex: 0),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          showModalBottomSheet<void>(
            context: context,
            backgroundColor: Colors.transparent,
            builder: (context) => Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.surfaceDark,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.grey[600],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.add_circle,
                          color: AppColors.primary,
                          size: 28,
                        ),
                      ),
                      title: const Text(
                        'Quick Book',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      subtitle: Text(
                        'Book a court by sport',
                        style: TextStyle(color: Colors.grey[400], fontSize: 12),
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        final venueProvider = Provider.of<VenueProvider>(
                          context,
                          listen: false,
                        );
                        if (venueProvider.venues.isEmpty) {
                          venueProvider.loadVenues();
                        }
                        context.push('/sport-select');
                      },
                    ),
                    const Divider(height: 24, color: Colors.white12),
                    ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.blue.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.calendar_today,
                          color: Colors.blue,
                          size: 28,
                        ),
                      ),
                      title: const Text(
                        'My Bookings',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      subtitle: Text(
                        'View and manage your bookings',
                        style: TextStyle(color: Colors.grey[400], fontSize: 12),
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/bookings');
                      },
                    ),
                  ],
                ),
              ),
            ),
          );
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: AppColors.backgroundDark),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
    );
  }

  Widget _buildVenueCard(Venue venue) {
    final isFavorited = _favoriteVenueIds.contains(venue.id);

    return GestureDetector(
      onTap: () {
        context.read<VenueProvider>().setSelectedVenue(venue);
        _navigateToVenueDetail(venue.id);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 24),
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 25,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                  child: Image.network(
                    venue.image ?? '',
                    height: 240,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        height: 240,
                        width: double.infinity,
                        color: AppColors.surfaceInput,
                        child: const Icon(
                          Icons.image_not_supported_outlined,
                          color: Colors.grey,
                          size: 40,
                        ),
                      );
                    },
                  ),
                ),
                // Premium Gradient Overlay
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.transparent,
                          AppColors.backgroundDark.withValues(alpha: 0.9),
                        ],
                      ),
                    ),
                  ),
                ),
                // Favorite on image (visible on any photo)
                Positioned(
                  top: 16,
                  left: 16,
                  child: GestureDetector(
                    onTap: () => _toggleFavorite(venue.id),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.45),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isFavorited
                                    ? Icons.favorite_rounded
                                    : Icons.favorite_border_rounded,
                                color: isFavorited
                                    ? AppColors.primary
                                    : Colors.white,
                                size: 20,
                              ),
                              if (venue.reviews != null &&
                                  venue.reviews! > 0) ...[
                                const SizedBox(width: 6),
                                Text(
                                  '${venue.reviews}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                // Glassmorphic Rating Chip
                Positioned(
                  top: 16,
                  right: 16,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.45),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              color: Colors.amber,
                              size: 18,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              venue.rating != null
                                  ? venue.rating!.toStringAsFixed(1)
                                  : 'NEW',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            if (venue.reviews != null &&
                                venue.reviews! > 0) ...[
                              const SizedBox(width: 6),
                              Text(
                                '(${venue.reviews})',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.85),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                // Amenities Badges
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ...(venue.amenities ?? const <String>[])
                          .take(2)
                          .map(
                            (amenity) => Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(
                                  alpha: 0.15,
                                ),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: AppColors.primary.withValues(
                                    alpha: 0.3,
                                  ),
                                ),
                              ),
                              child: Text(
                                amenity.toUpperCase(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                          ),
                    ],
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              venue.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                height: 1.1,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(
                                  Icons.location_on_rounded,
                                  color: AppColors.primary,
                                  size: 16,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '${venue.location ?? venue.address} • ${venue.distance ?? 'Nearby'}',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'FROM / HR',
                            style: TextStyle(
                              color: Colors.white38,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '₹${(venue.price ?? 0).toInt()}',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              fontFeatures: [FontFeature.tabularFigures()],
                              height: 1,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => _navigateToVenueDetail(venue.id),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.backgroundDark,
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: const Text(
                            'BOOK PASS',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      GestureDetector(
                        onTap: () => _toggleFavorite(venue.id),
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isFavorited
                                  ? AppColors.primary.withValues(alpha: 0.5)
                                  : Colors.white.withValues(alpha: 0.08),
                            ),
                          ),
                          child: Icon(
                            isFavorited
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            color: isFavorited
                                ? AppColors.primary
                                : Colors.white,
                            size: 26,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getSortLabel(String sortBy) {
    switch (sortBy) {
      case 'rating':
        return 'Sort: Best Rated';
      case 'price':
        return 'Sort: Price (Low to High)';
      case 'price_desc':
        return 'Sort: Price (High to Low)';
      case 'distance':
        return 'Sort: Distance';
      case 'name':
        return 'Sort: Name (A–Z)';
      default:
        return 'Sort: Best Rated';
    }
  }

  void _showSortOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SORT BY',
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.35,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildSortOption('rating', 'Best Rated', Icons.star),
                    _buildSortOption(
                      'name',
                      'Name: A to Z',
                      Icons.sort_by_alpha,
                    ),
                    _buildSortOption(
                      'price',
                      'Price: Low to High',
                      Icons.arrow_upward,
                    ),
                    _buildSortOption(
                      'price_desc',
                      'Price: High to Low',
                      Icons.arrow_downward,
                    ),
                    _buildSortOption('distance', 'Distance', Icons.location_on),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSortOption(String value, String label, IconData icon) {
    final isSelected = _sortBy == value;
    return GestureDetector(
      onTap: () {
        setState(() {
          _sortBy = value;
        });
        Navigator.pop(context);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.1)
              : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.primary : Colors.grey[500],
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: isSelected ? AppColors.primary : Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle, color: AppColors.primary, size: 20),
          ],
        ),
      ),
    );
  }

  void _showFilterModal() {
    // Initialize temporary state with current values
    double tempMaxPrice = _maxPrice;
    List<String> tempSelectedAmenities = List.from(_selectedAmenities);
    String? tempSelectedSport = _selectedSport;

    final amenitiesOptions = [
      'Parking',
      'Water',
      'Changing Room',
      'Floodlights',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return Consumer<SportProvider>(
            builder: (context, sportProvider, child) {
              final sports = sportProvider.sports;
              final isLoadingSports = sportProvider.isLoading;

              return Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.8),
                ),
                child: SafeArea(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Container(
                      width: double.infinity,
                      constraints: const BoxConstraints(maxHeight: 700),
                      margin: const EdgeInsets.all(16),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 32,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(40),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                      child: SingleChildScrollView(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Filters',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(
                                    Icons.close,
                                    color: Colors.grey,
                                  ),
                                  onPressed: () => Navigator.pop(context),
                                ),
                              ],
                            ),
                            const SizedBox(height: 32),
                            // Sport Selection
                            Text(
                              'SPORT',
                              style: TextStyle(
                                color: Colors.grey[500],
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.35,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.05),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.1),
                                ),
                              ),
                              child: isLoadingSports
                                  ? Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 16,
                                        vertical: 12,
                                      ),
                                      child: Row(
                                        children: [
                                          SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    AppColors.primary,
                                                  ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            'Loading sports...',
                                            style: TextStyle(
                                              color: Colors.grey[500],
                                              fontSize: 14,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                  : DropdownButton<String>(
                                      value: tempSelectedSport,
                                      isExpanded: true,
                                      underline: const SizedBox(),
                                      dropdownColor: AppColors.surfaceDark,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                      ),
                                      icon: Icon(
                                        Icons.expand_more,
                                        color: Colors.grey[500],
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 16,
                                        vertical: 12,
                                      ),
                                      items: [
                                        const DropdownMenuItem<String>(
                                          value: 'All',
                                          child: Text('All Sports'),
                                        ),
                                        ...sports.map((sport) {
                                          return DropdownMenuItem<String>(
                                            value: sport.name,
                                            child: Text(sport.name),
                                          );
                                        }),
                                      ],
                                      onChanged: (value) {
                                        if (value != null) {
                                          setModalState(() {
                                            tempSelectedSport = value;
                                          });
                                        }
                                      },
                                    ),
                            ),
                            const SizedBox(height: 32),
                            // Price Range
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'MAX HOURLY PRICE',
                                      style: TextStyle(
                                        color: Colors.grey[500],
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.35,
                                      ),
                                    ),
                                    Text(
                                      '₹${tempMaxPrice.toInt()}',
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                Slider(
                                  value: tempMaxPrice,
                                  min: 200,
                                  max: 1500,
                                  divisions: 26,
                                  activeColor: AppColors.primary,
                                  inactiveColor: Colors.white.withValues(
                                    alpha: 0.1,
                                  ),
                                  onChanged: (value) {
                                    setModalState(() {
                                      tempMaxPrice = value;
                                    });
                                  },
                                ),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      '₹200',
                                      style: TextStyle(
                                        color: Colors.grey[600],
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.25,
                                      ),
                                    ),
                                    Text(
                                      '₹1500',
                                      style: TextStyle(
                                        color: Colors.grey[600],
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.25,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 40),
                            // Amenities
                            Text(
                              'MUST-HAVE AMENITIES',
                              style: TextStyle(
                                color: Colors.grey[500],
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.35,
                              ),
                            ),
                            const SizedBox(height: 16),
                            GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    crossAxisSpacing: 16,
                                    mainAxisSpacing: 16,
                                    childAspectRatio: 2.5,
                                  ),
                              itemCount: amenitiesOptions.length,
                              itemBuilder: (context, index) {
                                final amenity = amenitiesOptions[index];
                                final isSelected = tempSelectedAmenities
                                    .contains(amenity);
                                return GestureDetector(
                                  onTap: () {
                                    setModalState(() {
                                      if (isSelected) {
                                        tempSelectedAmenities.remove(amenity);
                                      } else {
                                        tempSelectedAmenities.add(amenity);
                                      }
                                    });
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? AppColors.primary.withValues(
                                              alpha: 0.1,
                                            )
                                          : Colors.white.withValues(
                                              alpha: 0.05,
                                            ),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: isSelected
                                            ? AppColors.primary
                                            : Colors.white.withValues(
                                                alpha: 0.05,
                                              ),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          isSelected
                                              ? Icons.check_circle
                                              : Icons.circle_outlined,
                                          color: isSelected
                                              ? AppColors.primary
                                              : Colors.grey[500],
                                          size: 22,
                                        ),
                                        const SizedBox(width: 12),
                                        Flexible(
                                          child: Text(
                                            amenity.toUpperCase(),
                                            style: TextStyle(
                                              color: isSelected
                                                  ? AppColors.primary
                                                  : Colors.grey[500],
                                              fontSize: 12,
                                              fontWeight: FontWeight.w900,
                                              letterSpacing: 0.25,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 32),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      setModalState(() {
                                        tempMaxPrice = 1500;
                                        tempSelectedAmenities = [];
                                        tempSelectedSport = 'All';
                                      });
                                    },
                                    style: OutlinedButton.styleFrom(
                                      side: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.05,
                                        ),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                    ),
                                    child: const Text(
                                      'RESET',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.25,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  flex: 2,
                                  child: ElevatedButton(
                                    onPressed: () {
                                      // Apply changes to parent state
                                      setState(() {
                                        _maxPrice = tempMaxPrice;
                                        _selectedAmenities =
                                            tempSelectedAmenities;
                                        _selectedSport = tempSelectedSport;
                                      });
                                      Navigator.pop(context);
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: AppColors.backgroundDark,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                    ),
                                    child: const Text(
                                      'APPLY SETTINGS',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.25,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    ).whenComplete(() {
      setState(() {
        _isFilterOpen = false;
      });
    });
  }
}
