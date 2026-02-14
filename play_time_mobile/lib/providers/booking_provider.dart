import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/booking.dart';
import '../services/firestore_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class BookingProvider with ChangeNotifier {
  List<Booking> _bookings = [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription<List<Booking>>? _bookingsSubscription;

  List<Booking> get bookings => _bookings;
  bool get isLoading => _isLoading;
  String? get error => _error;

  BookingProvider() {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadBookings(user.uid);
    }
    
    // Listen to auth state changes
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        _loadBookings(user.uid);
      } else {
        _bookings = [];
        notifyListeners();
      }
    });
  }

  void _loadBookings(String userId) {
    _isLoading = true;
    _error = null;
    notifyListeners();

    _bookingsSubscription?.cancel();
    _bookingsSubscription = FirestoreService.getUserBookingsStream(userId).listen(
      (bookings) {
        _bookings = bookings;
        _isLoading = false;
        notifyListeners();
      },
      onError: (error) {
        _error = 'Failed to load bookings: $error';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  Future<(String, bool)> createBooking({
    required String venueId,
    required String venueName,
    required String courtId,
    required String courtName,
    required String sport,
    required DateTime startTime,
    required DateTime endTime,
    required double amount,
    String? venueImage,
    bool skipPayment = false,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Check if this is the user's first confirmed booking for convenience fee calculation
      final previousBookingsSnapshot = await FirebaseFirestore.instance
          .collection('bookings')
          .where('userId', isEqualTo: user.uid)
          .where('status', isEqualTo: 'Confirmed')
          .limit(1)
          .get();
      final isFirstTimeBooking = previousBookingsSnapshot.docs.isEmpty;

      // Check availability before creating booking
      final isAvailable = await FirestoreService.isSlotAvailable(
        venueId: venueId,
        courtId: courtId,
        startTime: startTime,
        endTime: endTime,
      );

      if (!isAvailable) {
        throw Exception('Time slot is no longer available. Please select another time.');
      }

      final bookingData = {
        'venueId': venueId,
        'venue': venueName,
        'venueImage': venueImage,
        'courtId': courtId,
        'court': courtName,
        'sport': sport,
        'userId': user.uid,
        'user': user.displayName ?? user.email ?? 'User',
        'startTime': Timestamp.fromDate(startTime),
        'endTime': Timestamp.fromDate(endTime),
        'duration': endTime.difference(startTime).inHours.toDouble(),
        'date': '${startTime.day} ${_getMonthName(startTime.month)}, ${startTime.year}',
        'time': '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}',
        'amount': amount,
        'isFirstTimeBooking': isFirstTimeBooking,
        'status': skipPayment ? 'Confirmed' : 'Pending',
        'paymentStatus': skipPayment ? 'Paid' : 'Pending',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      // Use transaction-based booking creation to prevent conflicts
      final bookingId = await FirestoreService.createBookingWithTransaction(bookingData);
      
      // Refresh bookings
      await refreshBookings();
      
      return (bookingId, isFirstTimeBooking);
    } catch (e) {
      _error = 'Failed to create booking: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> cancelBooking(String bookingId) async {
    try {
      await FirestoreService.cancelBooking(bookingId);
      await refreshBookings();
    } catch (e) {
      _error = 'Failed to cancel booking: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> refreshBookings() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadBookings(user.uid);
    }
  }

  Booking? getLatestUpcomingBooking() {
    try {
      return _bookings.firstWhere(
        (b) => b.status.isUpcoming,
      );
    } catch (e) {
      return null;
    }
  }

  List<Booking> getUpcomingBookings() {
    return _bookings.where((b) => b.status.isUpcoming).toList();
  }

  static String _getMonthName(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }

  @override
  void dispose() {
    _bookingsSubscription?.cancel();
    super.dispose();
  }
}

