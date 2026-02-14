import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../theme/app_colors.dart';
import '../providers/sport_provider.dart';
import '../providers/venue_provider.dart';
import '../providers/booking_provider.dart';
import '../models/venue.dart';
import '../models/court.dart';
import '../services/firestore_service.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';

class SportSelectScreen extends StatefulWidget {
  const SportSelectScreen({super.key});

  @override
  State<SportSelectScreen> createState() => _SportSelectScreenState();
}

class _SportSelectScreenState extends State<SportSelectScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String? _selectedSportForQuickBook;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sportProvider = Provider.of<SportProvider>(context);
    final venueProvider = Provider.of<VenueProvider>(context);
    final sports = sportProvider.sports;
    final venues = venueProvider.venues;

    // Calculate venue count per sport
    int getVenueCountForSport(String sportName) {
      return venues.where((venue) {
        return venue.sports.any((s) => 
          s.toLowerCase() == sportName.toLowerCase()
        );
      }).length;
    }

    // Filter sports based on search
    final filteredSports = _searchQuery.isEmpty
        ? sports
        : sports.where((sport) {
            return sport.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                   (sport.description?.toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
          }).toList();

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      child: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                    onPressed: () {
                      if (Navigator.canPop(context)) {
                        context.pop();
                      } else {
                        context.go('/home');
                      }
                    },
                  ),
                  Row(
                    children: [
                      const Icon(Icons.sports_tennis,
                          color: AppColors.primary, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'Play Time',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: () => context.pop(),
                    child: Text(
                      'SKIP',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Let\'s Play! 🏏',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'What are you playing today?',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Search
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceDark,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.05),
                      ),
                    ),
                    child: Row(
                      children: [
                        const SizedBox(width: 16),
                        Icon(Icons.search, color: Colors.grey[500]),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: 'Search sports...',
                              hintStyle: TextStyle(color: Colors.grey[600]),
                              border: InputBorder.none,
                            ),
                            onChanged: (value) {
                              setState(() {
                                _searchQuery = value;
                              });
                            },
                          ),
                        ),
                        if (_searchQuery.isNotEmpty)
                          IconButton(
                            icon: Icon(Icons.clear, color: Colors.grey[500], size: 20),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchQuery = '';
                              });
                            },
                          ),
                        const SizedBox(width: 12),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Sports Grid
            Expanded(
              child: sportProvider.isLoading
                  ? const LoadingWidget(message: 'Loading sports...')
                  : sportProvider.error != null
                      ? ErrorDisplayWidget(
                          message: sportProvider.error!,
                          onRetry: () => sportProvider.loadSports(),
                        )
                      : filteredSports.isEmpty
                          ? const EmptyStateWidget(
                              icon: Icons.sports_soccer,
                              title: 'No sports found',
                              message: 'Try adjusting your search',
                            )
                      : GridView.builder(
                          padding: const EdgeInsets.all(16),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 16,
                            mainAxisSpacing: 16,
                            childAspectRatio: 0.8,
                          ),
                          itemCount: filteredSports.length,
                          itemBuilder: (context, index) {
                            final sport = filteredSports[index];
                            final venueCount = getVenueCountForSport(sport.name);
                            final hasVenues = venueCount > 0;
                            
                            return GestureDetector(
                              onTap: () {
                                setState(() {
                                  _selectedSportForQuickBook = sport.name;
                                });
                                _showQuickBookModal(venueProvider, venues);
                              },
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.05),
                                  ),
                                ),
                                child: Stack(
                                  children: [
                                    // Sport Image or Color Background
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(24),
                                      child: sport.imageUrl != null && sport.imageUrl!.isNotEmpty
                                          ? Image.network(
                                              sport.imageUrl!,
                                              width: double.infinity,
                                              height: double.infinity,
                                              fit: BoxFit.cover,
                                              errorBuilder: (context, error, stackTrace) {
                                                return Container(
                                                  color: sport.color != null
                                                      ? Color(int.parse(sport.color!.replaceFirst('#', '0xFF')))
                                                      : AppColors.surfaceDark,
                                                );
                                              },
                                            )
                                          : Container(
                                              color: sport.color != null
                                                  ? Color(int.parse(sport.color!.replaceFirst('#', '0xFF')))
                                                  : AppColors.surfaceDark,
                                            ),
                                    ),
                                    Container(
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(24),
                                        gradient: LinearGradient(
                                          begin: Alignment.topCenter,
                                          end: Alignment.bottomCenter,
                                          colors: [
                                            Colors.transparent,
                                            AppColors.backgroundDark.withOpacity(0.5),
                                            AppColors.backgroundDark,
                                          ],
                                        ),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(20),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 6,
                                            ),
                                            decoration: BoxDecoration(
                                              color: hasVenues
                                                  ? AppColors.primary.withOpacity(0.2)
                                                  : AppColors.surfaceDark.withOpacity(0.6),
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(
                                                color: hasVenues
                                                    ? AppColors.primary.withOpacity(0.3)
                                                    : Colors.white.withOpacity(0.1),
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                if (hasVenues) ...[
                                                  Container(
                                                    width: 6,
                                                    height: 6,
                                                    decoration: const BoxDecoration(
                                                      color: AppColors.primary,
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                ],
                                                Text(
                                                  venueCount > 0
                                                      ? '$venueCount ${venueCount == 1 ? 'Venue' : 'Venues'}'
                                                      : 'No Venues',
                                                  style: TextStyle(
                                                    color: hasVenues
                                                        ? AppColors.primary
                                                        : Colors.white.withOpacity(0.9),
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w900,
                                                    letterSpacing: 1,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                sport.name,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.w900,
                                                ),
                                              ),
                                              if (sport.description != null) ...[
                                                const SizedBox(height: 4),
                                                Text(
                                                  sport.description!.toUpperCase(),
                                                  style: TextStyle(
                                                    color: AppColors.textSecondary,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w700,
                                                    letterSpacing: 0.5,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
            // Quick Book Button
            Padding(
              padding: const EdgeInsets.all(16),
              child: ElevatedButton.icon(
                onPressed: () => _showQuickBookModal(venueProvider, venues),
                icon: const Icon(Icons.bolt, size: 20),
                label: const Text(
                  'QUICK BOOK',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.backgroundDark,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 18,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showQuickBookModal(VenueProvider venueProvider, List<Venue> venues) {
    // Filter venues by selected sport if available
    final availableVenues = _selectedSportForQuickBook != null
        ? venues.where((venue) => venue.sports.any(
              (s) => s.toLowerCase() == _selectedSportForQuickBook!.toLowerCase(),
            )).toList()
        : venues;

    if (availableVenues.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _selectedSportForQuickBook != null
                ? 'No venues available for $_selectedSportForQuickBook'
                : 'No venues available',
          ),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _QuickBookModal(
        venues: availableVenues,
        selectedSport: _selectedSportForQuickBook,
      ),
    );
  }
}

class _QuickBookModal extends StatefulWidget {
  final List<Venue> venues;
  final String? selectedSport;

  const _QuickBookModal({
    required this.venues,
    this.selectedSport,
  });

  @override
  State<_QuickBookModal> createState() => _QuickBookModalState();
}

class _QuickBookModalState extends State<_QuickBookModal> {
  Venue? _selectedVenue;
  String? _selectedCourtId;
  List<Court> _courts = [];
  String? _selectedSlotId;
  List<Map<String, dynamic>> _timeSlots = [];
  int _selectedDateIndex = 0; // 0 = today, 1 = tomorrow
  bool _isLoadingCourts = false;
  bool _isLoadingSlots = false;
  bool _isBooking = false;

  List<Map<String, dynamic>> get _dates {
    final days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final result = <Map<String, dynamic>>[];
    for (int i = 0; i < 2; i++) {
      final d = DateTime.now().add(Duration(days: i));
      result.add({
        'dayName': days[d.weekday % 7],
        'dateNum': d.day,
        'month': months[d.month - 1],
        'fullDate': '${d.day} ${months[d.month - 1]}, ${d.year}',
        'dateTime': d,
        'label': i == 0 ? 'Today' : 'Tomorrow',
      });
    }
    return result;
  }

  @override
  void initState() {
    super.initState();
    if (widget.venues.isNotEmpty) {
      _selectedVenue = widget.venues.first;
      _loadCourts();
    }
  }

  Future<void> _loadCourts() async {
    if (_selectedVenue == null) return;

    setState(() {
      _isLoadingCourts = true;
      _courts = [];
      _selectedCourtId = null;
      _timeSlots = [];
      _selectedSlotId = null;
    });

    try {
      final courts = await FirestoreService.getCourtsByVenue(_selectedVenue!.id);
      if (courts.isNotEmpty) {
        // Filter courts by sport if sport is selected
        final filteredCourts = widget.selectedSport != null
            ? courts.where((court) => court.sport.toLowerCase() == widget.selectedSport!.toLowerCase()).toList()
            : courts;

        setState(() {
          _courts = filteredCourts;
          if (filteredCourts.isNotEmpty) {
            _selectedCourtId = filteredCourts.first.id;
            _loadTimeSlots();
          }
          _isLoadingCourts = false;
        });
      } else {
        setState(() => _isLoadingCourts = false);
      }
    } catch (e) {
      setState(() => _isLoadingCourts = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load courts: $e')),
        );
      }
    }
  }

  Future<void> _loadTimeSlots() async {
    if (_selectedCourtId == null || _selectedVenue == null) return;

    setState(() {
      _isLoadingSlots = true;
      _timeSlots = [];
      _selectedSlotId = null;
    });

    try {
      final selectedDate = _dates[_selectedDateIndex]['dateTime'] as DateTime;
      final slots = await FirestoreService.getAvailableTimeSlots(
        venueId: _selectedVenue!.id,
        courtId: _selectedCourtId!,
        date: selectedDate,
      );

      setState(() {
        _timeSlots = slots;
        _isLoadingSlots = false;
      });
    } catch (e) {
      setState(() => _isLoadingSlots = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load time slots: $e')),
        );
      }
    }
  }

  void _onVenueChanged(Venue? venue) {
    setState(() {
      _selectedVenue = venue;
    });
    _loadCourts();
  }

  void _onCourtChanged(String? courtId) {
    setState(() {
      _selectedCourtId = courtId;
      _selectedSlotId = null;
    });
    _loadTimeSlots();
  }

  void _onDateChanged(int index) {
    setState(() {
      _selectedDateIndex = index;
      _selectedSlotId = null;
    });
    _loadTimeSlots();
  }

  Future<void> _handleQuickBook() async {
    if (_selectedVenue == null || _selectedCourtId == null || _selectedSlotId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select venue, court, and time slot'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please login to book'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isBooking = true);

    try {
      final selectedSlot = _timeSlots.firstWhere(
        (s) => s['id'] == _selectedSlotId,
      );

      final selectedCourt = _courts.firstWhere((c) => c.id == _selectedCourtId);
      final hour = selectedSlot['hour'] as int;
      final minute = selectedSlot['minute'] as int;

      final selectedDate = _dates[_selectedDateIndex]['dateTime'] as DateTime;
      final startTime = DateTime(selectedDate.year, selectedDate.month, selectedDate.day, hour, minute);
      final endTime = startTime.add(const Duration(hours: 1));

      final bookingProvider = Provider.of<BookingProvider>(context, listen: false);
      final sport = widget.selectedSport ?? selectedCourt.sport;

      await bookingProvider.createBooking(
        venueId: _selectedVenue!.id,
        venueName: _selectedVenue!.name,
        courtId: _selectedCourtId!,
        courtName: selectedCourt.name,
        sport: sport,
        startTime: startTime,
        endTime: endTime,
        amount: selectedCourt.pricePerHour,
        venueImage: _selectedVenue!.image,
        skipPayment: false,
      );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Booking created! Redirecting to checkout...'),
            backgroundColor: AppColors.primary,
          ),
        );
        // Navigate to checkout
        context.push('/checkout');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create booking: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isBooking = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.8),
      ),
      child: SafeArea(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            width: double.infinity,
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.9,
            ),
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surfaceDark,
              borderRadius: BorderRadius.circular(40),
              border: Border.all(
                color: Colors.white.withOpacity(0.1),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Quick Book',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.grey),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                // Venue Selection
                Text(
                  'SELECT VENUE',
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                  child: DropdownButton<Venue>(
                    value: _selectedVenue,
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
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    items: widget.venues.map((venue) {
                      return DropdownMenuItem<Venue>(
                        value: venue,
                        child: Text(venue.name),
                      );
                    }).toList(),
                    onChanged: _onVenueChanged,
                  ),
                ),
                const SizedBox(height: 24),
                // Date Selection
                Text(
                  'SELECT DATE',
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: _dates.asMap().entries.map((entry) {
                    final index = entry.key;
                    final date = entry.value;
                    final isSelected = _selectedDateIndex == index;
                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(right: index == 0 ? 8 : 0),
                        child: GestureDetector(
                          onTap: () => _onDateChanged(index),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primary.withOpacity(0.1)
                                  : Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : Colors.white.withOpacity(0.1),
                              ),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  date['label'] as String,
                                  style: TextStyle(
                                    color: isSelected ? AppColors.primary : Colors.grey[500],
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${date['dayName']}, ${date['dateNum']} ${date['month']}',
                                  style: TextStyle(
                                    color: isSelected ? AppColors.primary : Colors.grey[400],
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                if (_isLoadingCourts) ...[
                  const SizedBox(height: 24),
                  const Center(child: CircularProgressIndicator()),
                ] else if (_courts.isEmpty && _selectedVenue != null) ...[
                  const SizedBox(height: 24),
                  Center(
                    child: Text(
                      'No courts available',
                      style: TextStyle(color: Colors.grey[500]),
                    ),
                  ),
                ] else if (_courts.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  // Court Selection
                  Text(
                    'SELECT COURT',
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.1),
                      ),
                    ),
                    child: DropdownButton<String>(
                      value: _selectedCourtId,
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
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      items: _courts.map((court) {
                        return DropdownMenuItem<String>(
                          value: court.id,
                          child: Text('${court.name} - ₹${court.pricePerHour.toInt()}/hr'),
                        );
                      }).toList(),
                      onChanged: _onCourtChanged,
                    ),
                  ),
                  if (_isLoadingSlots) ...[
                    const SizedBox(height: 24),
                    const Center(child: CircularProgressIndicator()),
                  ] else if (_timeSlots.isEmpty && _selectedCourtId != null) ...[
                    const SizedBox(height: 24),
                    Center(
                      child: Text(
                        'No time slots available',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    ),
                  ] else if (_timeSlots.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    // Time Slot Selection
                    Text(
                      'SELECT TIME',
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: _timeSlots.take(6).map((slot) {
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
                            width: 80,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: !isAvailable
                                  ? Colors.black.withOpacity(0.4)
                                  : isSelected
                                      ? AppColors.primary
                                      : AppColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: !isAvailable
                                    ? Colors.white.withOpacity(0.05)
                                    : isSelected
                                        ? AppColors.primary
                                        : AppColors.primary.withOpacity(0.3),
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
                                          : AppColors.primary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
                const SizedBox(height: 32),
                // Book Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: (_selectedVenue == null ||
                            _selectedCourtId == null ||
                            _selectedSlotId == null ||
                            _isBooking)
                        ? null
                        : _handleQuickBook,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.backgroundDark,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      disabledBackgroundColor: Colors.grey[800],
                    ),
                    child: _isBooking
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                AppColors.backgroundDark,
                              ),
                            ),
                          )
                        : const Text(
                            'BOOK NOW',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.5,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

