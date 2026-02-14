import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../theme/app_colors.dart';
import '../providers/venue_provider.dart';
import '../providers/booking_provider.dart';
import '../models/venue.dart';
import '../models/court.dart';
import '../services/firestore_service.dart';
import '../services/payment_service.dart';
import '../models/booking.dart';

class VenueDetailScreen extends StatefulWidget {
  final String venueId;

  const VenueDetailScreen({super.key, required this.venueId});

  @override
  State<VenueDetailScreen> createState() => _VenueDetailScreenState();
}

class _VenueDetailScreenState extends State<VenueDetailScreen> {
  int _selectedDateIndex = 0;
  String? _selectedSlotId;
  bool _agreedToTerms = false;
  double _holdProgress = 0;
  bool _isHolding = false;
  bool _isBooking = false;
  bool _bookingSuccess = false;
  bool _isLoadingSlots = false;
  String? _selectedCourtId;
  List<Court> _courts = [];
  List<Map<String, dynamic>> _timeSlots = [];
  bool _isFavorited = false;

  List<Map<String, dynamic>> get _dates {
    final days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  @override
  void initState() {
    super.initState();
    _loadCourts();
    _loadFavoriteStatus();
    if (_isHolding && _agreedToTerms) {
      _startHoldProgress();
    }
  }

  Future<void> _loadFavoriteStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      try {
        final isFavorited = await FirestoreService.isVenueFavorited(user.uid, widget.venueId);
        setState(() {
          _isFavorited = isFavorited;
        });
      } catch (e) {
        print('Error loading favorite status: $e');
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
      final courts = await FirestoreService.getCourtsByVenue(widget.venueId);
      if (courts.isNotEmpty) {
        setState(() {
          _courts = courts;
          _selectedCourtId = courts.first.id;
        });
        await _loadTimeSlots();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load courts: $e')),
        );
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

  void _startHoldProgress() {
    Future.delayed(const Duration(milliseconds: 50), () {
      if (mounted && _isHolding && _agreedToTerms) {
        setState(() {
          if (_holdProgress >= 100) {
            _handleBookSlot();
            return;
          }
          _holdProgress += 5;
        });
        _startHoldProgress();
      }
    });
  }

  void _handleBookSlot() async {
    if (_selectedSlotId == null || _selectedCourtId == null) return;

    setState(() {
      _isBooking = true;
      _isHolding = false;
      _holdProgress = 0;
    });

    if (!mounted) return;

    final selectedSlot = _timeSlots.firstWhere(
      (s) => s['id'] == _selectedSlotId,
      orElse: () => _timeSlots.first,
    );
    
    // Get venue from provider
    final venueProvider = Provider.of<VenueProvider>(context, listen: false);
    Venue? venue;
    try {
      venue = venueProvider.venues.firstWhere((v) => v.id == widget.venueId);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Venue not found')),
        );
      }
      setState(() => _isBooking = false);
      return;
    }

    // Get selected court
    final selectedCourt = _courts.firstWhere((c) => c.id == _selectedCourtId);

    // Parse time slot to DateTime
    final hour = selectedSlot['hour'] as int;
    final minute = selectedSlot['minute'] as int;
    
    final selectedDate = _dates[_selectedDateIndex]['dateTime'] as DateTime;
    final startTime = DateTime(selectedDate.year, selectedDate.month, selectedDate.day, hour, minute);
    final endTime = startTime.add(const Duration(hours: 1));
    
    // Create booking in Firestore (without payment first)
    final bookingProvider = Provider.of<BookingProvider>(context, listen: false);
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
        amount: selectedCourt.pricePerHour,
        venueImage: venue.image,
        skipPayment: false, // Will process payment after booking creation
      );
      bookingId = id;
      isFirstTimeBooking = isFirst;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create booking: $e'),
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
      setState(() {
        _isBooking = false;
        _bookingSuccess = true;
      });
      return;
    }

    // Create booking object for payment
    final booking = Booking(
      id: bookingId,
      venueName: venue.name,
      venueImage: venue.image,
      date: '${startTime.day} ${_getMonthName(startTime.month)}, ${startTime.year}',
      time: '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}',
      amount: selectedCourt.pricePerHour,
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
        onError: (error) {
          if (mounted) {
            setState(() => _isBooking = false);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Payment failed: $error. Booking created but payment pending.'),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 5),
              ),
            );
            // Still show success screen but with payment pending status
            setState(() => _bookingSuccess = true);
          }
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isBooking = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment error: $e. Booking created but payment pending.'),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 5),
          ),
        );
        setState(() => _bookingSuccess = true);
      }
    }
  }

  static String _getMonthName(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }

  String get _activeCategory {
    if (_courts.isNotEmpty && _selectedCourtId != null) {
      final court = _courts.firstWhere((c) => c.id == _selectedCourtId, orElse: () => _courts.first);
      return court.sport;
    }
    final venueProvider = Provider.of<VenueProvider>(context, listen: false);
    try {
      final venue = venueProvider.venues.firstWhere((v) => v.id == widget.venueId);
      return venue.sports.isNotEmpty ? venue.sports.first : 'Football';
    } catch (e) {
      return 'Football';
    }
  }

  @override
  Widget build(BuildContext context) {
    final venueProvider = Provider.of<VenueProvider>(context);
    Venue? venue;
    
    try {
      venue = venueProvider.venues.firstWhere((v) => v.id == widget.venueId);
    } catch (e) {
      // Venue not found in provider, show loading or error
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: const Center(
          child: CircularProgressIndicator(),
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
                  final venue = Provider.of<VenueProvider>(context, listen: false)
                      .venues
                      .firstWhere((v) => v.id == widget.venueId, orElse: () => throw Exception('Venue not found'));
                  
                  final shareText = 'Check out ${venue.name} on PlayTime!\n\n'
                      '📍 ${venue.address}\n'
                      '💰 Price: ₹${(venue.price ?? 0).toInt()}/hr\n'
                      '⭐ Rating: ${venue.rating != null ? venue.rating!.toStringAsFixed(1) : 'NEW'}\n\n'
                      'Book your slot now on PlayTime app!';
                  
                  try {
                    await Share.share(shareText);
                  } catch (e) {
                    // Fallback to clipboard if share fails (e.g. on some web environments)
                    await Clipboard.setData(ClipboardData(text: shareText));
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Venue details copied to clipboard'),
                          behavior: SnackBarBehavior.floating,
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
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
                              venue.rating != null ? venue.rating!.toStringAsFixed(1) : 'NEW',
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
                  const Text(
                    'Select Date & Time',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 16),
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
                                  letterSpacing: 1,
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
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  else if (_timeSlots.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Text(
                          'No time slots available for this date',
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
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
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
                                          : AppColors.primary.withValues(alpha: 0.8),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
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
            top: BorderSide(
              color: Colors.white.withValues(alpha: 0.05),
            ),
          ),
        ),
        child: SafeArea(
          child: Row(
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
                      letterSpacing: 1,
                    ),
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '₹${(_courts.isNotEmpty && _selectedCourtId != null ? _courts.firstWhere((c) => c.id == _selectedCourtId, orElse: () => _courts.first).pricePerHour : venue.price ?? 0).toInt()}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        '/hour',
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
                child: ElevatedButton(
                  onPressed: _selectedSlotId == null || _isBooking
                      ? null
                      : () {
                          showDialog(
                            context: context,
                            barrierColor: Colors.black.withValues(alpha: 0.8),
                            builder: (context) => _buildConfirmDialog(),
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
                            letterSpacing: 0.5,
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


  Widget _buildBookingSuccessScreen(Venue venue) {
    final selectedSlot = _timeSlots.firstWhere(
      (s) => s['id'] == _selectedSlotId,
      orElse: () => _timeSlots.first,
    );
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
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
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
                            letterSpacing: 1,
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
                            letterSpacing: 1,
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
                            letterSpacing: 1,
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
                      letterSpacing: 1,
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

  Widget _buildConfirmDialog() {
    final selectedSlot = _timeSlots.firstWhere(
      (s) => s['id'] == _selectedSlotId,
      orElse: () => _timeSlots.first,
    );
    final selectedDate = _dates[_selectedDateIndex];

    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.surfaceDark,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.1),
          ),
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
                                'DATE',
                                style: TextStyle(
                                  color: Colors.grey[500],
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1,
                                ),
                              ),
                              Text(
                                selectedDate['fullDate'] as String,
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
                                  letterSpacing: 1,
                                ),
                              ),
                              Text(
                                selectedSlot['time'] as String,
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
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () => setState(() => _agreedToTerms = !_agreedToTerms),
                          child: Container(
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
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _agreedToTerms = !_agreedToTerms),
                            child: Text(
                              'I agree to the Cancellation Policy & Terms.',
                              style: TextStyle(
                                color: Colors.grey[400],
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              Navigator.pop(context);
                            },
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
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: GestureDetector(
                            onTapDown: (_) {
                              if (_agreedToTerms) {
                                setState(() {
                                  _isHolding = true;
                                  _holdProgress = 0;
                                });
                                _startHoldProgress();
                              }
                            },
                            onTapUp: (_) {
                              setState(() {
                                _isHolding = false;
                                _holdProgress = 0;
                              });
                            },
                            onTapCancel: () {
                              setState(() {
                                _isHolding = false;
                                _holdProgress = 0;
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              decoration: BoxDecoration(
                                color: _agreedToTerms
                                    ? Colors.white.withValues(alpha: 0.05)
                                    : Colors.grey[600],
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: _agreedToTerms
                                      ? AppColors.primary.withValues(alpha: 0.2)
                                      : Colors.transparent,
                                ),
                              ),
                              child: Stack(
                                children: [
                                  Positioned.fill(
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: AppColors.primary.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                      width: MediaQuery.of(context).size.width * (_holdProgress / 100),
                                    ),
                                  ),
                                  Center(
                                    child: Text(
                                      _holdProgress > 0 ? 'HOLDING...' : 'HOLD TO CONFIRM',
                                      style: TextStyle(
                                        color: _agreedToTerms
                                            ? AppColors.primary
                                            : Colors.grey[400],
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1,
                                      ),
                                    ),
                                  ),
                                ],
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

