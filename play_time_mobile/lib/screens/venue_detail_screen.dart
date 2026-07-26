import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../theme/app_colors.dart';
import '../constants/app_strings.dart';
import '../providers/venue_provider.dart';
import '../providers/booking_provider.dart';
import '../providers/membership_provider.dart';
import '../providers/engagement_provider.dart';
import '../models/venue.dart';
import '../models/court.dart';
import '../models/membership_plan.dart';
import '../services/firestore_service.dart';
import '../services/payment_service.dart';
import '../models/booking.dart';
import '../services/analytics_service.dart';
import '../widgets/shimmer_box.dart';
import '../providers/sport_provider.dart';
import '../utils/sport_utils.dart';
import '../utils/error_utils.dart';
import '../utils/booking_time_policy.dart';

class VenueDetailScreen extends StatefulWidget {
  final String venueId;

  const VenueDetailScreen({super.key, required this.venueId});

  @override
  State<VenueDetailScreen> createState() => _VenueDetailScreenState();
}

class _VenueDetailScreenState extends State<VenueDetailScreen> {
  int _selectedDateIndex = 0;
  String? _selectedSlotId;
  bool _isBooking = false;
  bool _bookingSuccess = false;
  bool _isLoadingSlots = false;
  String? _selectedCourtId;
  List<Court> _courts = [];
  List<Map<String, dynamic>> _timeSlots = [];
  bool _isFavorited = false;
  int _bookingDurationMinutes = 60;
  Venue? _venue;
  bool _isLoadingVenue = true;
  bool _isPurchasingSubscription = false;

  List<Map<String, dynamic>> get _dates {
    final days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final result = <Map<String, dynamic>>[];
    for (int i = 0; i < 7; i++) {
      final d = DateTime.now().add(Duration(days: i));
      result.add({
        'dayName': days[d.weekday % 7],
        'dateNum': d.day,
        'month': months[d.month - 1],
        'fullDate': '${d.day} ${months[d.month - 1]}, ${d.year}',
        'dateTime': d,
      });
    }
    return result;
  }

  String _courtLabel(Court court) {
    final sportProvider = context.read<SportProvider>();
    final sportName = sportProvider.getSportById(court.sport)?.name;
    final displaySport =
        sportName ?? (court.sport.length > 20 ? '' : court.sport);
    final courtName = court.name.trim().isNotEmpty ? court.name : 'Court';
    if (displaySport.isEmpty) return courtName;
    return '$courtName · $displaySport';
  }

  @override
  void initState() {
    super.initState();
    AnalyticsService.logScreenView(
      screenName: 'venue_detail',
      screenClass: 'VenueDetailScreen',
    );
    _loadVenue();
    _loadCourts();
    _loadFavoriteStatus();
  }

  Future<void> _loadVenue() async {
    if (widget.venueId.isEmpty) {
      if (mounted) setState(() => _isLoadingVenue = false);
      return;
    }
    final venueProvider = Provider.of<VenueProvider>(context, listen: false);
    try {
      final fromProvider = venueProvider.venues.firstWhere(
        (v) => v.id == widget.venueId,
      );
      if (mounted) {
        setState(() {
          _venue = fromProvider;
          _isLoadingVenue = false;
        });
      }
      return;
    } catch (_) {}

    final fetched = await FirestoreService.getVenueById(widget.venueId);
    if (mounted) {
      setState(() {
        _venue = fetched;
        _isLoadingVenue = false;
      });
    }
  }

  Court? get _selectedCourt {
    if (_selectedCourtId == null || _courts.isEmpty) return null;
    try {
      return _courts.firstWhere((c) => c.id == _selectedCourtId);
    } catch (_) {
      return _courts.first;
    }
  }

  String? _operatingHoursLabel() {
    final court = _selectedCourt;
    if (court == null) return null;
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    final dayName =
        days[(_dates[_selectedDateIndex]['dateTime'] as DateTime).weekday - 1];
    final avail = court.getAvailabilityForDay(dayName);
    if (avail == null || !avail.available) return null;
    return formatOperatingHours(avail.start, avail.end);
  }

  double _priceForDuration(Court court) {
    if (_bookingDurationMinutes == 30) {
      return court.pricePerHour / 2;
    }
    return court.pricePerHour;
  }

  Future<void> _loadFavoriteStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      try {
        final isFavorited = await FirestoreService.isVenueFavorited(
          user.uid,
          widget.venueId,
        );
        setState(() {
          _isFavorited = isFavorited;
        });
      } catch (e) {
        debugPrint('Error loading favorite status: $e');
      }
    }
  }

  Future<void> _toggleFavorite() async {
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
      setState(() {
        _isFavorited = !_isFavorited;
      });

      await FirestoreService.toggleFavoriteVenue(user.uid, widget.venueId);
    } catch (e) {
      // Revert on error
      setState(() {
        _isFavorited = !_isFavorited;
      });
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

  Future<void> _loadCourts() async {
    setState(() => _isLoadingSlots = true);
    try {
      // Prefer courts from the courts collection (source of truth)
      List<Court> courts = await FirestoreService.getCourtsByVenue(
        widget.venueId,
      );

      // Fallback: if collection returned empty, use venue document's courts array
      // (e.g. when index is building or venue was synced from admin)
      if (courts.isEmpty && mounted) {
        Venue? venue;
        try {
          venue = Provider.of<VenueProvider>(
            context,
            listen: false,
          ).venues.firstWhere((v) => v.id == widget.venueId);
        } catch (_) {
          venue = null;
        }
        if (venue != null && venue.courts != null && venue.courts!.isNotEmpty) {
          courts = venue.courts!
              .map((c) {
                final data = Map<String, dynamic>.from(c);
                final courtId = (data['id'] as String?)?.trim();
                final resolvedId = (courtId != null && courtId.isNotEmpty)
                    ? courtId
                    : '${widget.venueId}_${(data['name'] as String? ?? 'court').toString().replaceAll(' ', '_').toLowerCase()}';
                data['venueId'] ??= widget.venueId;
                return Court.fromFirestore(resolvedId, data);
              })
              .where((court) => court.status == 'Active')
              .toList();
        }
      }

      if (courts.isNotEmpty) {
        setState(() {
          _courts = courts;
          _selectedCourtId = courts.first.id;
        });
        await _loadTimeSlots();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to load courts: $e')));
      }
    } finally {
      setState(() => _isLoadingSlots = false);
    }
  }

  Future<void> _loadTimeSlots() async {
    if (_selectedCourtId == null) return;

    setState(() {
      _isLoadingSlots = true;
      _timeSlots = [];
      _selectedSlotId = null;
    });

    try {
      final selectedDate = _dates[_selectedDateIndex]['dateTime'] as DateTime;
      final slots = await FirestoreService.getAvailableTimeSlots(
        venueId: widget.venueId,
        courtId: _selectedCourtId!,
        date: selectedDate,
        courtOverride: _selectedCourt,
        slotDurationMinutes: _bookingDurationMinutes,
      );

      setState(() {
        _timeSlots = slots;
        _isLoadingSlots = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load time slots: $e')),
        );
      }
      setState(() => _isLoadingSlots = false);
    }
  }

  void _onDateSelected(int index) {
    setState(() {
      _selectedDateIndex = index;
      _selectedSlotId = null;
    });
    _loadTimeSlots();
  }

  void _handleBookSlot() async {
    if (_selectedSlotId == null || _selectedCourtId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(AppStrings.noTimeSlots),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    unawaited(
      AnalyticsService.logBookingStarted(
        venueId: widget.venueId,
        sport: _activeCategory,
      ),
    );

    setState(() => _isBooking = true);

    if (!mounted) return;

    if (_timeSlots.isEmpty) {
      setState(() => _isBooking = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No time slots available. Please try again.'),
          ),
        );
      }
      return;
    }
    final selectedSlot = _timeSlots.firstWhere(
      (s) => s['id'] == _selectedSlotId,
      orElse: () => _timeSlots.first,
    );
    if (selectedSlot['available'] != true) {
      setState(() => _isBooking = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This slot is no longer available. Please choose another.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    // Get venue from provider, or fall back to venue loaded directly for this screen
    final venueProvider = Provider.of<VenueProvider>(context, listen: false);
    Venue? venue;
    try {
      venue = venueProvider.venues.firstWhere((v) => v.id == widget.venueId);
    } catch (_) {
      venue = _venue;
    }
    if (venue == null) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Venue not found')));
      }
      setState(() => _isBooking = false);
      return;
    }

    // Get selected court
    final selectedCourt = _courts.firstWhere(
      (c) => c.id == _selectedCourtId,
      orElse: () => _courts.first,
    );

    // Parse time slot to DateTime
    final hour = selectedSlot['hour'] as int;
    final minute = selectedSlot['minute'] as int;

    final selectedDate = _dates[_selectedDateIndex]['dateTime'] as DateTime;
    // Local wall-clock for the picked calendar day; Firestore stores absolute instants via Timestamp.
    final startTime = DateTime(
      selectedDate.year,
      selectedDate.month,
      selectedDate.day,
      hour,
      minute,
    );
    if (!BookingTimePolicy.isBookable(startTime)) {
      setState(() {
        _isBooking = false;
        _selectedSlotId = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(BookingTimePolicy.errorMessage),
          backgroundColor: AppColors.error,
        ),
      );
      await _loadTimeSlots();
      return;
    }
    final endTime = startTime.add(Duration(minutes: _bookingDurationMinutes));
    final bookingAmount = _priceForDuration(selectedCourt);

    // Create booking in Firestore (without payment first)
    final bookingProvider = Provider.of<BookingProvider>(
      context,
      listen: false,
    );
    String bookingId;
    bool isFirstTimeBooking = false;

    try {
      final (id, isFirst) = await bookingProvider.createBooking(
        venueId: venue.id,
        venueName: venue.name,
        courtId: selectedCourt.id,
        courtName: selectedCourt.name,
        sport: _activeCategory,
        startTime: startTime,
        endTime: endTime,
        amount: bookingAmount,
        courtOverride: selectedCourt,
        venueImage: venue.image,
        skipPayment: false, // Will process payment after booking creation
      );
      bookingId = id;
      isFirstTimeBooking = isFirst;
      unawaited(
        AnalyticsService.logBookingCompleted(
          bookingId: id,
          venueId: venue.id,
          amount: bookingAmount,
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'Could not create booking. Please try another slot.',
              ),
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
      setState(() => _isBooking = false);
      return;
    }

    // Get user details for payment
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // Cancel the booking we just created since we can't pay
      try {
        await bookingProvider.cancelBooking(bookingId);
      } catch (cancelErr) {
        debugPrint(
          'Failed to cancel booking after user-null error: $cancelErr',
        );
      }
      if (mounted) {
        setState(() => _isBooking = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Session expired. Please log in again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    // Create booking object for payment
    final booking = Booking(
      id: bookingId,
      venueName: venue.name,
      venueImage: venue.image,
      date:
          '${startTime.day} ${_getMonthName(startTime.month)}, ${startTime.year}',
      time:
          '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}',
      amount: bookingAmount,
      sport: _activeCategory,
      status: BookingStatus.pending,
      isFirstTimeBooking: isFirstTimeBooking,
    );

    // Process payment
    try {
      await PaymentService.processBookingPayment(
        booking: booking,
        venue: venue,
        userId: user.uid,
        userName: user.displayName ?? user.email ?? 'User',
        userEmail: user.email,
        userPhone: user.phoneNumber,
        onSuccess: (paymentId) {
          AnalyticsService.logPaymentSuccess(
            bookingId: bookingId,
            amount: bookingAmount,
          );
          if (mounted) {
            setState(() {
              _isBooking = false;
              _bookingSuccess = true;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Booking confirmed and payment successful!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
        onError: (error) async {
          final chargedButNotRecorded = error
              .toLowerCase()
              .contains('payment successful');
          unawaited(
            AnalyticsService.logPaymentFailed(
              bookingId: bookingId,
              reason: error,
            ),
          );
          // Never cancel a booking when Razorpay charged successfully but the
          // local status write failed; the verified webhook will reconcile it.
          if (!chargedButNotRecorded) {
            try {
              await bookingProvider.cancelBooking(
                bookingId,
                paymentFailed: true,
              );
            } catch (cancelErr) {
              debugPrint(
                'Failed to cancel booking after payment error: $cancelErr',
              );
            }
          }
          if (mounted) {
            setState(() => _isBooking = false);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  chargedButNotRecorded
                      ? '$error Keep your payment receipt; the booking will be reconciled automatically.'
                      : 'Payment failed: $error. Please try again.',
                ),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 5),
              ),
            );
          }
        },
      );
    } catch (e) {
      unawaited(
        AnalyticsService.logPaymentFailed(
          bookingId: bookingId,
          reason: e.toString(),
        ),
      );
      // Cancel the pending booking
      try {
        await bookingProvider.cancelBooking(
          bookingId,
          paymentFailed: true,
        );
      } catch (cancelErr) {
        debugPrint('Failed to cancel booking after exception: $cancelErr');
      }
      if (mounted) {
        setState(() => _isBooking = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Payment error. Booking has been cancelled. Please try again.',
            ),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  static String _getMonthName(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[month - 1];
  }

  Widget _buildVenueEventsSection(Venue venue) {
    return Consumer<EngagementProvider>(
      builder: (context, engagement, _) {
        final matches = engagement.upcomingQuickMatchesForVenue(venue.id);
        final tournaments = engagement.openTournamentsForVenue(venue.id);
        final deals = engagement.flashDealsForVenue(venue.id);
        if (matches.isEmpty && tournaments.isEmpty && deals.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'At this venue',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'No open matches or tournaments here right now. Book a court below, or browse Team Up for other venues.',
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.push('/team-up'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  padding: EdgeInsets.zero,
                ),
                child: const Text(
                  'Browse Team Up',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'At this venue',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                TextButton(
                  onPressed: () => context.push('/team-up'),
                  child: const Text(
                    'See all',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            if (matches.isNotEmpty) ...[
              Text(
                'Open matches',
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              ...matches.take(3).map(
                (m) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _venueEventTile(
                    icon: Icons.sports,
                    title: m.sport,
                    subtitle:
                        '${m.currentPlayers}/${m.maxPlayers} players · ${m.time}',
                    onTap: () => context.push('/team-up'),
                  ),
                ),
              ),
            ],
            if (tournaments.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Tournaments',
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              ...tournaments.take(3).map(
                (t) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _venueEventTile(
                    icon: Icons.emoji_events,
                    title: t.name,
                    subtitle: '${t.sport} · Register in Team Up',
                    onTap: () => context.push('/team-up'),
                  ),
                ),
              ),
            ],
            if (deals.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Flash deals',
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              ...deals.take(2).map(
                (d) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _venueEventTile(
                    icon: Icons.local_offer,
                    title: d.title,
                    subtitle: '₹${d.discountedPrice.toInt()}',
                    onTap: () {},
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _venueEventTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: AppColors.surfaceDark,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.grey[400],
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey[600], size: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVenueSubscriptionsSection(Venue venue) {
    return Consumer<MembershipProvider>(
      builder: (context, membershipProvider, _) {
        final plans = membershipProvider.venueSubscriptionPlans(venue.id);
        if (plans.isEmpty) return const SizedBox.shrink();

        final active = membershipProvider.getActiveVenueSubscription(venue.id);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Subscriptions',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Venue plans for discounted or priority access at ${venue.name}.',
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 13,
                height: 1.4,
              ),
            ),
            if (active != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.35),
                  ),
                ),
                child: Text(
                  'Active: ${active.planName} · expires ${_formatSubscriptionDate(active.endDate)}',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            ...plans.map((plan) {
              final isCurrent = active?.planId == plan.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceDark,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isCurrent
                          ? AppColors.primary.withValues(alpha: 0.5)
                          : Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              plan.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '₹${plan.price.toInt()} · ${plan.planType}',
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        onPressed:
                            (_isPurchasingSubscription || isCurrent)
                            ? null
                            : () => _purchaseVenueSubscription(plan, venue),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.backgroundDark,
                          disabledBackgroundColor: Colors.white.withValues(
                            alpha: 0.08,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          isCurrent ? 'ACTIVE' : 'SUBSCRIBE',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        );
      },
    );
  }

  String _formatSubscriptionDate(DateTime date) {
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${date.day} ${months[date.month - 1]}, ${date.year}';
  }

  Future<void> _purchaseVenueSubscription(
    MembershipPlan plan,
    Venue venue,
  ) async {
    if (_isPurchasingSubscription) return;
    setState(() => _isPurchasingSubscription = true);

    String? membershipId;
    final membershipProvider = Provider.of<MembershipProvider>(
      context,
      listen: false,
    );

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please login to subscribe'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      if (plan.venueId == null || plan.venueId != venue.id) {
        throw Exception('This subscription belongs to another venue');
      }

      membershipId = await membershipProvider.createMembership(
        planId: plan.id,
        venueId: venue.id,
        price: plan.price,
      );

      await PaymentService.processMembershipPayment(
        membershipId: membershipId,
        venueId: venue.id,
        amount: plan.price,
        userId: user.uid,
        userName: user.displayName ?? user.email ?? 'User',
        userEmail: user.email,
        userPhone: user.phoneNumber,
        onSuccess: (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Subscription activated!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        },
        onError: (error) async {
          final chargedButNotRecorded = error
              .toLowerCase()
              .contains('payment successful');
          final pendingId = membershipId;
          if (!chargedButNotRecorded && pendingId != null) {
            await membershipProvider.cancelPendingMembership(pendingId);
          }
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  chargedButNotRecorded
                      ? '$error Keep your receipt; the subscription will be reconciled automatically.'
                      : 'Payment failed: $error',
                ),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 5),
              ),
            );
          }
        },
      );
    } catch (e) {
      final pendingId = membershipId;
      if (pendingId != null) {
        await membershipProvider.cancelPendingMembership(pendingId);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to subscribe: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPurchasingSubscription = false);
      }
    }
  }

  Widget _buildDurationChip({
    required String label,
    required int minutes,
    required String subtitle,
    bool usePrimaryWhenSelected = true,
  }) {
    final selected = _bookingDurationMinutes == minutes;
    final Color bg;
    final Color fg;
    final Color border;

    if (selected) {
      if (usePrimaryWhenSelected) {
        bg = AppColors.primary;
        fg = AppColors.backgroundDark;
        border = AppColors.primary;
      } else {
        bg = AppColors.surfaceDark;
        fg = Colors.white;
        border = Colors.white.withValues(alpha: 0.35);
      }
    } else {
      bg = AppColors.surfaceDark;
      fg = Colors.white70;
      border = Colors.white.withValues(alpha: 0.08);
    }

    return GestureDetector(
      onTap: () {
        if (_bookingDurationMinutes == minutes) return;
        setState(() {
          _bookingDurationMinutes = minutes;
          _selectedSlotId = null;
        });
        _loadTimeSlots();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border, width: selected ? 1.5 : 1),
        ),
        child: Column(
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: fg,
                fontSize: 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: selected && !usePrimaryWhenSelected
                    ? AppColors.textSecondary
                    : fg.withValues(alpha: 0.85),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String get _activeCategory {
    if (_courts.isNotEmpty && _selectedCourtId != null) {
      final court = _courts.firstWhere(
        (c) => c.id == _selectedCourtId,
        orElse: () => _courts.first,
      );
      return court.sport;
    }
    final venueProvider = Provider.of<VenueProvider>(context, listen: false);
    try {
      final venue = venueProvider.venues.firstWhere(
        (v) => v.id == widget.venueId,
      );
      return venue.sports.isNotEmpty ? venue.sports.first : 'Football';
    } catch (e) {
      return 'Football';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingVenue) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final venue = _venue;
    if (venue == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: AppColors.backgroundDark,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () =>
                context.canPop() ? context.pop() : context.go('/home'),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.location_off, color: Colors.grey, size: 48),
              const SizedBox(height: 16),
              Text(
                AppStrings.venueNotFound,
                style: TextStyle(color: Colors.grey[400], fontSize: 16),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => context.go('/home'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.backgroundDark,
                ),
                child: const Text('GO HOME'),
              ),
            ],
          ),
        ),
      );
    }

    if (_bookingSuccess) {
      return _buildBookingSuccessScreen(venue);
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 320,
            pinned: true,
            backgroundColor: Colors.transparent,
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.arrow_back, color: Colors.white),
              ),
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/home');
                }
              },
            ),
            actions: [
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.share, color: Colors.white),
                ),
                onPressed: () async {
                  // Share venue details using native share sheet
                  final messenger = ScaffoldMessenger.of(context);
                  final venueList = Provider.of<VenueProvider>(
                    context,
                    listen: false,
                  ).venues;
                  Venue? venue;
                  try {
                    venue = venueList.firstWhere((v) => v.id == widget.venueId);
                  } catch (_) {}
                  if (venue == null) return;

                  final shareText =
                      'Check out ${venue.name} on PlayTime!\n\n'
                      '📍 ${venue.address}\n'
                      '💰 Price: ₹${(venue.price ?? 0).toInt()}/hr\n'
                      '⭐ Rating: ${venue.rating != null ? venue.rating!.toStringAsFixed(1) : 'NEW'}\n\n'
                      'Book your slot now on PlayTime app!';

                  try {
                    await Share.share(shareText);
                  } catch (e) {
                    // Fallback to clipboard if share fails (e.g. on some web environments)
                    await Clipboard.setData(ClipboardData(text: shareText));
                    messenger.showSnackBar(
                      const SnackBar(
                        content: Text('Venue details copied to clipboard'),
                        behavior: SnackBarBehavior.floating,
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                },
              ),
              IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    _isFavorited ? Icons.favorite : Icons.favorite_border,
                    color: _isFavorited ? AppColors.primary : Colors.white,
                  ),
                ),
                onPressed: _toggleFavorite,
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    venue.image ?? '',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        color: AppColors.surfaceDark,
                        child: const Icon(Icons.image, color: Colors.grey),
                      );
                    },
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.3),
                          Colors.transparent,
                          AppColors.backgroundDark,
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              venue.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(
                                  Icons.location_on,
                                  color: AppColors.primary,
                                  size: 18,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '${venue.address}${venue.distance != null ? ' • ${venue.distance} away' : ''}',
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceDark,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                        ),
                        child: Row(
                          children: [
                            Text(
                              venue.rating != null
                                  ? venue.rating!.toStringAsFixed(1)
                                  : 'NEW',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.star_rounded,
                              color: Colors.amber,
                              size: 16,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'About Venue',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Experience world-class sports facilities at ${venue.name}. Perfect for corporate events, friendly matches, and regular training.',
                    style: TextStyle(
                      color: Colors.grey[300],
                      fontSize: 14,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 32),
                  _buildVenueEventsSection(venue),
                  const SizedBox(height: 32),
                  _buildVenueSubscriptionsSection(venue),
                  const SizedBox(height: 32),
                  const Text(
                    'Select Date & Time',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (_operatingHoursLabel() != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.schedule, color: Colors.grey[500], size: 16),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Custom hours: ${_operatingHoursLabel()}',
                            style: TextStyle(
                              color: Colors.grey[400],
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),
                  const Text(
                    'DURATION',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _buildDurationChip(
                          label: 'FULL HOUR',
                          minutes: 60,
                          subtitle: '60 min',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildDurationChip(
                          label: 'HALF HOUR',
                          minutes: 30,
                          subtitle: '30 min',
                          usePrimaryWhenSelected: false,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (_courts.isNotEmpty) ...[
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'SELECT TURF / COURT',
                        style: TextStyle(
                          color: Colors.grey[400],
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _courts.map((court) {
                        final selected = _selectedCourtId == court.id;
                        return ChoiceChip(
                          label: Text(
                            _courtLabel(court),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          selected: selected,
                          onSelected: (_) {
                            setState(() => _selectedCourtId = court.id);
                            _loadTimeSlots();
                          },
                          selectedColor: AppColors.primary,
                          labelStyle: TextStyle(
                            color: selected
                                ? AppColors.backgroundDark
                                : Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                          side: BorderSide(
                            color: selected
                                ? AppColors.primary
                                : Colors.white24,
                          ),
                          backgroundColor: AppColors.surfaceDark,
                        );
                      }).toList(),
                    ),
                    if (_selectedCourt != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Showing slots for ${_selectedCourt!.name}',
                        style: TextStyle(
                          color: AppColors.primary.withValues(alpha: 0.9),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                  ],
                  SizedBox(
                    height: 90,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: _dates.length,
                      itemBuilder: (context, index) {
                        final dateData = _dates[index];
                        final isSelected = _selectedDateIndex == index;
                        return GestureDetector(
                          onTap: () => _onDateSelected(index),
                          child: Container(
                            width: 70,
                            margin: const EdgeInsets.only(right: 12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.surfaceDark,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  dateData['dayName'] as String,
                                  style: TextStyle(
                                    color: isSelected
                                        ? AppColors.backgroundDark
                                        : Colors.grey[500],
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.25,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  (dateData['dateNum'] as int).toString(),
                                  style: TextStyle(
                                    color: isSelected
                                        ? AppColors.backgroundDark
                                        : Colors.white,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (_isLoadingSlots)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8.0),
                      child: ShimmerSlotsGrid(itemCount: 9),
                    )
                  else if (_courts.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Text(
                          AppStrings.noCourts,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    )
                  else if (_timeSlots.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Text(
                          AppStrings.noTimeSlots,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    )
                  else
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 2.5,
                          ),
                      itemCount: _timeSlots.length,
                      itemBuilder: (context, index) {
                        final slot = _timeSlots[index];
                        final isAvailable = slot['available'] as bool;
                        final isSelected = slot['id'] == _selectedSlotId;
                        return GestureDetector(
                          onTap: isAvailable
                              ? () {
                                  setState(() {
                                    _selectedSlotId = slot['id'] as String;
                                  });
                                }
                              : null,
                          child: Container(
                            decoration: BoxDecoration(
                              color: !isAvailable
                                  ? Colors.black.withValues(alpha: 0.4)
                                  : isSelected
                                  ? AppColors.primary
                                  : AppColors.primary.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: !isAvailable
                                    ? Colors.white.withValues(alpha: 0.05)
                                    : isSelected
                                    ? AppColors.primary
                                    : AppColors.primary.withValues(alpha: 0.2),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                slot['time'] as String,
                                style: TextStyle(
                                  color: !isAvailable
                                      ? Colors.grey[700]
                                      : isSelected
                                      ? AppColors.backgroundDark
                                      : AppColors.primary.withValues(
                                          alpha: 0.8,
                                        ),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.backgroundDark.withValues(alpha: 0.95),
          border: Border(
            top: BorderSide(color: Colors.white.withValues(alpha: 0.05)),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_selectedSlotId == null && _timeSlots.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Select date, court and time slot to book',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ),
              Row(
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TOTAL PRICE',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.25,
                        ),
                      ),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            '₹${(_selectedCourt != null ? _priceForDuration(_selectedCourt!) : venue.price ?? 0).toInt()}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            _bookingDurationMinutes == 30
                                ? '/half hr'
                                : '/hour',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Spacer(),
                  Expanded(
                    flex: 2,
                    child: Semantics(
                      label: 'Book court',
                      button: true,
                      child: ElevatedButton(
                        onPressed: _selectedSlotId == null || _isBooking
                            ? null
                            : () {
                                if (_timeSlots.isEmpty) return;
                                final selectedSlot = _timeSlots.firstWhere(
                                  (s) => s['id'] == _selectedSlotId,
                                  orElse: () => _timeSlots.first,
                                );
                                final selectedDate = _dates[_selectedDateIndex];
                                showDialog<void>(
                                  context: context,
                                  barrierColor: Colors.black.withValues(
                                    alpha: 0.8,
                                  ),
                                  builder: (context) => _BookingConfirmDialog(
                                    selectedSlot: selectedSlot,
                                    selectedDate: selectedDate,
                                    onBack: () => Navigator.of(context).pop(),
                                    onConfirm: () {
                                      Navigator.of(context).pop();
                                      _handleBookSlot();
                                    },
                                  ),
                                );
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _selectedSlotId == null || _isBooking
                              ? Colors.grey[600]
                              : AppColors.primary,
                          foregroundColor: AppColors.backgroundDark,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: _isBooking
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    AppColors.backgroundDark,
                                  ),
                                ),
                              )
                            : const Text(
                                'BOOK SLOT',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.2,
                                ),
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
    );
  }

  Widget _buildBookingSuccessScreen(Venue venue) {
    final selectedSlot = _timeSlots.isNotEmpty
        ? _timeSlots.firstWhere(
            (s) => s['id'] == _selectedSlotId,
            orElse: () => _timeSlots.first,
          )
        : <String, dynamic>{};
    final selectedDate = _dates[_selectedDateIndex];

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.check_circle,
                  color: AppColors.primary,
                  size: 48,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Booking Confirmed!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your slot at ${venue.name} is secured. Get ready to play!',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surfaceDark,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.05),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'VENUE',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.25,
                          ),
                        ),
                        Text(
                          venue.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'DATE',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.25,
                          ),
                        ),
                        Text(
                          selectedDate['fullDate'] as String,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'TIME',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.25,
                          ),
                        ),
                        Text(
                          selectedSlot['time'] as String,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => context.go('/home'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.backgroundDark,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'BACK TO HOME',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.25,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Booking confirmation dialog with local state so checkbox and buttons update correctly.
/// Uses a simple "Confirm" button (enabled when user agrees) instead of hold-to-confirm.
class _BookingConfirmDialog extends StatefulWidget {
  final Map<String, dynamic> selectedSlot;
  final Map<String, dynamic> selectedDate;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  const _BookingConfirmDialog({
    required this.selectedSlot,
    required this.selectedDate,
    required this.onBack,
    required this.onConfirm,
  });

  @override
  State<_BookingConfirmDialog> createState() => _BookingConfirmDialogState();
}

class _BookingConfirmDialogState extends State<_BookingConfirmDialog> {
  bool _agreedToTerms = false;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Text(
              'Final Confirmation',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'DATE',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.25,
                        ),
                      ),
                      Text(
                        widget.selectedDate['fullDate'] as String,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'TIME',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.25,
                        ),
                      ),
                      Text(
                        widget.selectedSlot['time'] as String,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Semantics(
              label: 'I agree to the Cancellation Policy and Terms',
              toggled: _agreedToTerms,
              child: InkWell(
                onTap: () => setState(() => _agreedToTerms = !_agreedToTerms),
                borderRadius: BorderRadius.circular(8),
                child: Row(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: _agreedToTerms
                            ? AppColors.primary
                            : Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: _agreedToTerms
                              ? AppColors.primary
                              : Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                      child: _agreedToTerms
                          ? const Icon(
                              Icons.check,
                              color: AppColors.backgroundDark,
                              size: 16,
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'I agree to the Cancellation Policy & Terms.',
                        style: TextStyle(color: Colors.grey[400], fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: widget.onBack,
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.05),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      'BACK',
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
                  child: Semantics(
                    label: 'Confirm booking',
                    button: true,
                    enabled: _agreedToTerms,
                    child: ElevatedButton(
                      onPressed: _agreedToTerms ? widget.onConfirm : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _agreedToTerms
                            ? AppColors.primary
                            : Colors.grey[700],
                        foregroundColor: _agreedToTerms
                            ? AppColors.backgroundDark
                            : Colors.grey[500],
                        disabledBackgroundColor: Colors.grey[800],
                        disabledForegroundColor: Colors.grey[600],
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'CONFIRM',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
