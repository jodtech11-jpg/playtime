import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../models/venue.dart';
import '../models/booking.dart';
import '../models/product.dart';
import '../models/team.dart';
import '../models/match_feed_item.dart';
import '../models/court.dart';
import '../models/membership_plan.dart';
import '../models/membership.dart';
import '../models/order.dart' as order_model;
import '../models/quick_match.dart';
import '../models/tournament_summary.dart';
import '../models/engagement.dart';

class FirestoreService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Statuses counted for court availability (must match Firestore rules `isActiveBooking`).
  static const List<String> activeBookingStatuses = ['Pending', 'Confirmed'];

  /// Bookings query for slot availability — filters by active status so rules allow read.
  static Query<Map<String, dynamic>> courtBookingsForAvailability({
    required String venueId,
    required String courtId,
    DateTime? dayStart,
    DateTime? dayEnd,
  }) {
    var query = _firestore
        .collection('bookings')
        .where('venueId', isEqualTo: venueId)
        .where('courtId', isEqualTo: courtId)
        .where('status', whereIn: activeBookingStatuses);
    if (dayStart != null) {
      query = query.where(
        'startTime',
        isGreaterThanOrEqualTo: Timestamp.fromDate(dayStart),
      );
    }
    if (dayEnd != null) {
      query = query.where('startTime', isLessThan: Timestamp.fromDate(dayEnd));
    }
    return query;
  }

  // ==================== VENUES ====================
  static Stream<List<Venue>> getVenuesStream() {
    return _firestore
        .collection('venues')
        .where('status', isEqualTo: 'Active')
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => Venue.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<Venue>> getVenues() async {
    try {
      final snapshot = await _firestore
          .collection('venues')
          .where('status', isEqualTo: 'Active')
          .get();
      return snapshot.docs
          .map((doc) => Venue.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching venues: $e');
      return [];
    }
  }

  static Future<Venue?> getVenueById(String venueId) async {
    try {
      final doc = await _firestore.collection('venues').doc(venueId).get();
      if (doc.exists) {
        return Venue.fromFirestore(doc.id, doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching venue: $e');
      return null;
    }
  }

  static Future<List<Venue>> getVenuesBySport(String sport) async {
    try {
      final snapshot = await _firestore
          .collection('venues')
          .where('status', isEqualTo: 'Active')
          .where('sports', arrayContains: sport)
          .get();
      return snapshot.docs
          .map((doc) => Venue.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching venues by sport: $e');
      return [];
    }
  }

  static Future<List<Venue>> getNearbyVenues(
    double latitude,
    double longitude,
    double radiusKm,
  ) async {
    try {
      final allVenues = await getVenues();
      final nearbyVenues = <Venue>[];

      for (final venue in allVenues) {
        if (venue.locationLat != null && venue.locationLng != null) {
          final distance = Geolocator.distanceBetween(
            latitude,
            longitude,
            venue.locationLat!,
            venue.locationLng!,
          );
          if (distance <= radiusKm * 1000) {
            nearbyVenues.add(venue);
          }
        }
      }

      return nearbyVenues;
    } catch (e) {
      debugPrint('Error fetching nearby venues: $e');
      return [];
    }
  }

  // ==================== BOOKINGS ====================
  static Stream<List<Booking>> getUserBookingsStream(String userId) {
    return _firestore
        .collection('bookings')
        .where('userId', isEqualTo: userId)
        .orderBy('startTime', descending: true)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => Booking.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<Booking>> getUserBookings(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('bookings')
          .where('userId', isEqualTo: userId)
          .orderBy('startTime', descending: true)
          .get();
      return snapshot.docs
          .map((doc) => Booking.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching bookings: $e');
      return [];
    }
  }

  /// Fetch a single booking by id (e.g. for booking pass screen).
  static Future<Booking?> getBookingById(String bookingId) async {
    try {
      final doc = await _firestore.collection('bookings').doc(bookingId).get();
      if (doc.exists && doc.data() != null) {
        return Booking.fromFirestore(doc.id, doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching booking by id: $e');
      return null;
    }
  }

  static Future<String> createBooking(Map<String, dynamic> bookingData) async {
    try {
      final docRef = await _firestore.collection('bookings').add({
        ...bookingData,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      debugPrint('Error creating booking: $e');
      rethrow;
    }
  }

  static Future<void> updateBooking(
    String bookingId,
    Map<String, dynamic> updates,
  ) async {
    try {
      await _firestore.collection('bookings').doc(bookingId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error updating booking: $e');
      rethrow;
    }
  }

  static Future<void> cancelBooking(String bookingId) async {
    try {
      final ref = _firestore.collection('bookings').doc(bookingId);
      final snap = await ref.get();
      final lockId = snap.data()?['slotLockId'] as String?;
      final batch = _firestore.batch();
      batch.update(ref, {
        'status': 'Cancelled',
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (lockId != null && lockId.isNotEmpty) {
        batch.delete(_firestore.collection('booking_slot_locks').doc(lockId));
      }
      await batch.commit();
    } catch (e) {
      debugPrint('Error cancelling booking: $e');
      rethrow;
    }
  }

  // ==================== COURTS ====================
  static Future<List<Court>> getCourtsByVenue(String venueId) async {
    try {
      // Query by venueId only (no composite index required); filter Active in code
      final snapshot = await _firestore
          .collection('courts')
          .where('venueId', isEqualTo: venueId)
          .get();
      return snapshot.docs
          .map((doc) => Court.fromFirestore(doc.id, doc.data()))
          .where((court) => court.status == 'Active')
          .toList();
    } catch (e) {
      debugPrint('Error fetching courts: $e');
      return [];
    }
  }

  static Future<Court?> getCourtById(String courtId) async {
    try {
      final doc = await _firestore.collection('courts').doc(courtId).get();
      if (doc.exists) {
        return Court.fromFirestore(doc.id, doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching court: $e');
      return null;
    }
  }

  static Stream<List<Court>> getCourtsByVenueStream(String venueId) {
    return _firestore
        .collection('courts')
        .where('venueId', isEqualTo: venueId)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => Court.fromFirestore(doc.id, doc.data()))
              .where((court) => court.status == 'Active')
              .toList(),
        );
  }

  // ==================== AVAILABILITY CHECKING ====================
  /// Check if a time slot is available for a court.
  /// Uses venueId + courtId only (no composite index) and filters status/overlap in code.
  static Future<bool> isSlotAvailable({
    required String venueId,
    required String courtId,
    required DateTime startTime,
    required DateTime endTime,
  }) async {
    try {
      final snapshot = await courtBookingsForAvailability(
        venueId: venueId,
        courtId: courtId,
      ).get();

      for (final doc in snapshot.docs) {
        final data = doc.data();
        final start = data['startTime'];
        final end = data['endTime'];
        if (start is! Timestamp || end is! Timestamp) continue;

        final bookingStart = start.toDate();
        final bookingEnd = end.toDate();
        if (startTime.isBefore(bookingEnd) && endTime.isAfter(bookingStart)) {
          return false; // Conflict found
        }
      }

      // Check court availability schedule
      final court = await getCourtById(courtId);
      if (court == null) return false;

      const days = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
      final dayName = days[startTime.weekday - 1];

      if (!court.isAvailableOnDay(dayName)) return false;

      final dayAvailability = court.getAvailabilityForDay(dayName);
      if (dayAvailability == null) return false;

      final (startHour, startMinute) = dayAvailability.parseTime(
        dayAvailability.start,
      );
      final (endHour, endMinute) = dayAvailability.parseTime(
        dayAvailability.end,
      );

      final slotStartMinutes = startTime.hour * 60 + startTime.minute;
      final slotEndMinutes = endTime.hour * 60 + endTime.minute;
      final courtStartMinutes = startHour * 60 + startMinute;
      final courtEndMinutes = endHour * 60 + endMinute;

      if (slotStartMinutes < courtStartMinutes ||
          slotEndMinutes > courtEndMinutes) {
        return false;
      }

      return true;
    } catch (e) {
      debugPrint('isSlotAvailable error: $e');
      // On query failure, conservatively block the slot to prevent overbooking
      return false;
    }
  }

  /// Generate available time slots for a court on a specific date.
  /// Pass [courtOverride] when the court was loaded from the venue document
  /// (embedded courts may not exist in the `courts` collection).
  static Future<List<Map<String, dynamic>>> getAvailableTimeSlots({
    required String venueId,
    required String courtId,
    required DateTime date,
    Court? courtOverride,
    int slotDurationMinutes = 60,
  }) async {
    try {
      Court? court = courtOverride;
      if (court == null && courtId.isNotEmpty) {
        court = await getCourtById(courtId);
      }
      if (court == null) {
        debugPrint('getAvailableTimeSlots: court not found for $courtId');
        return [];
      }

      // Get day name (DateTime.weekday: 1=Monday .. 7=Sunday)
      const days = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
      final dayName = days[date.weekday - 1];

      // Check if court is available on this day
      if (!court.isAvailableOnDay(dayName)) {
        debugPrint('getAvailableTimeSlots: court not available on $dayName');
        return [];
      }

      final dayAvailability = court.getAvailabilityForDay(dayName);
      if (dayAvailability == null) {
        debugPrint('getAvailableTimeSlots: no day availability for $dayName');
        return [];
      }

      // Parse availability times
      final (startHour, startMinute) = dayAvailability.parseTime(
        dayAvailability.start,
      );
      final (endHour, endMinute) = dayAvailability.parseTime(
        dayAvailability.end,
      );

      // Existing bookings for overlap checks on this date.
      final startOfDay = DateTime(date.year, date.month, date.day);
      final startOfNextDay = startOfDay.add(const Duration(days: 1));
      final bookings = await courtBookingsForAvailability(
        venueId: venueId,
        courtId: courtId,
        dayStart: startOfDay,
        dayEnd: startOfNextDay,
      ).get();

      final bookedRanges = <(DateTime, DateTime)>[];
      for (final doc in bookings.docs) {
        final data = doc.data();
        final start = data['startTime'];
        final end = data['endTime'];
        if (start is Timestamp && end is Timestamp) {
          bookedRanges.add((start.toDate(), end.toDate()));
        }
      }

      bool slotOverlapsBooking(DateTime slotStart, DateTime slotEnd) {
        for (final (bStart, bEnd) in bookedRanges) {
          if (slotStart.isBefore(bEnd) && slotEnd.isAfter(bStart)) {
            return true;
          }
        }
        return false;
      }

      String formatDisplayTime(int hour, int minute) {
        final period = hour >= 12 ? 'PM' : 'AM';
        final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
        return '$displayHour:${minute.toString().padLeft(2, '0')} $period';
      }

      final courtStartMinutes = startHour * 60 + startMinute;
      final courtEndMinutes = endHour * 60 + endMinute;
      final interval = slotDurationMinutes.clamp(15, 120);

      final slots = <Map<String, dynamic>>[];
      for (
        int totalMinutes = courtStartMinutes;
        totalMinutes + interval <= courtEndMinutes;
        totalMinutes += interval
      ) {
        final hour = totalMinutes ~/ 60;
        final minute = totalMinutes % 60;
        final slotStart = DateTime(
          date.year,
          date.month,
          date.day,
          hour,
          minute,
        );
        final slotEnd = slotStart.add(Duration(minutes: interval));

        final withinCourtHours =
            dayAvailability.isTimeSlotAvailable(hour, minute) &&
            dayAvailability.isTimeSlotAvailable(
              slotEnd.subtract(const Duration(minutes: 1)).hour,
              slotEnd.subtract(const Duration(minutes: 1)).minute,
            );

        final available =
            withinCourtHours && !slotOverlapsBooking(slotStart, slotEnd);
        final time24 =
            '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';

        slots.add({
          'id': 'slot_${hour}_${minute}_$interval',
          'time': formatDisplayTime(hour, minute),
          'time24': time24,
          'hour': hour,
          'minute': minute,
          'durationMinutes': interval,
          'available': available,
        });
      }

      return slots;
    } catch (e, st) {
      debugPrint('getAvailableTimeSlots error: $e');
      debugPrint('$st');
      // Fail closed: propagate so the UI can show an error instead of falsely
      // marking every slot as available.
      rethrow;
    }
  }

  /// Create booking with conflict check then atomic write.
  /// Queries by venueId + courtId only, then filters status and overlap in code (no composite index).
  /// A [booking_slot_locks] document serializes same start/end for one court (reduces double-booking races).
  /// Overlapping intervals with different start times still need a Cloud Function for full safety.
  static Future<String> createBookingWithTransaction(
    Map<String, dynamic> bookingData,
  ) async {
    try {
      final venueId = bookingData['venueId'] as String;
      final courtId = bookingData['courtId'] as String;
      final startTime = (bookingData['startTime'] as Timestamp).toDate();
      final endTime = (bookingData['endTime'] as Timestamp).toDate();

      // Conflict check outside transaction (collection queries cannot run inside one)
      final snapshot = await courtBookingsForAvailability(
        venueId: venueId,
        courtId: courtId,
      ).get();

      for (final doc in snapshot.docs) {
        final data = doc.data();
        final start = data['startTime'];
        final end = data['endTime'];
        if (start is! Timestamp || end is! Timestamp) continue;

        final bookingStart = start.toDate();
        final bookingEnd = end.toDate();
        if (startTime.isBefore(bookingEnd) && endTime.isAfter(bookingStart)) {
          throw Exception(
            'Time slot is already booked. Please select another time.',
          );
        }
      }

      final startMs =
          (bookingData['startTime'] as Timestamp).millisecondsSinceEpoch;
      final endMs =
          (bookingData['endTime'] as Timestamp).millisecondsSinceEpoch;
      final slotLockId = '${venueId}_${courtId}_${startMs}_$endMs';
      final lockRef = _firestore
          .collection('booking_slot_locks')
          .doc(slotLockId);
      final docRef = _firestore.collection('bookings').doc();

      await _firestore.runTransaction((transaction) async {
        final lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists) {
          throw Exception(
            'Time slot is already booked. Please select another time.',
          );
        }
        transaction.set(lockRef, {
          'venueId': venueId,
          'courtId': courtId,
          'userId': bookingData['userId'],
          'startTime': bookingData['startTime'],
          'endTime': bookingData['endTime'],
          'bookingId': docRef.id,
          'createdAt': FieldValue.serverTimestamp(),
        });
        transaction.set(docRef, {
          ...bookingData,
          'slotLockId': slotLockId,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });

      return docRef.id;
    } catch (e) {
      debugPrint('createBookingWithTransaction error: $e');
      rethrow;
    }
  }

  // ==================== MEMBERSHIP PLANS ====================
  static Stream<List<MembershipPlan>> getMembershipPlansStream({
    String? venueId,
  }) {
    Query query = _firestore
        .collection('membershipPlans')
        .where('isActive', isEqualTo: true);

    if (venueId != null) {
      query = query.where('venueId', isEqualTo: venueId);
    }

    return query.snapshots().map(
      (snapshot) => snapshot.docs
          .map(
            (doc) => MembershipPlan.fromFirestore(
              doc.id,
              doc.data() as Map<String, dynamic>,
            ),
          )
          .toList(),
    );
  }

  static Future<List<MembershipPlan>> getMembershipPlans({
    String? venueId,
  }) async {
    try {
      Query query = _firestore
          .collection('membershipPlans')
          .where('isActive', isEqualTo: true);

      if (venueId != null) {
        query = query.where('venueId', isEqualTo: venueId);
      }

      final snapshot = await query.get();
      return snapshot.docs
          .map(
            (doc) => MembershipPlan.fromFirestore(
              doc.id,
              doc.data() as Map<String, dynamic>,
            ),
          )
          .toList();
    } catch (e) {
      debugPrint('Error fetching membership plans: $e');
      return [];
    }
  }

  static Future<MembershipPlan?> getMembershipPlanById(String planId) async {
    try {
      final doc = await _firestore
          .collection('membershipPlans')
          .doc(planId)
          .get();
      if (doc.exists) {
        return MembershipPlan.fromFirestore(doc.id, doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching membership plan: $e');
      return null;
    }
  }

  // ==================== MEMBERSHIPS ====================
  static Stream<List<Membership>> getUserMembershipsStream(String userId) {
    return _firestore
        .collection('memberships')
        .where('userId', isEqualTo: userId)
        .orderBy('startDate', descending: true)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => Membership.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<Membership>> getUserMemberships(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('memberships')
          .where('userId', isEqualTo: userId)
          .orderBy('startDate', descending: true)
          .get();
      return snapshot.docs
          .map((doc) => Membership.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching memberships: $e');
      return [];
    }
  }

  static Future<String> createMembership(
    Map<String, dynamic> membershipData,
  ) async {
    try {
      final docRef = await _firestore.collection('memberships').add({
        ...membershipData,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      debugPrint('Error creating membership: $e');
      rethrow;
    }
  }

  static Future<void> updateMembership(
    String membershipId,
    Map<String, dynamic> updates,
  ) async {
    try {
      await _firestore.collection('memberships').doc(membershipId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error updating membership: $e');
      rethrow;
    }
  }

  static Future<Membership?> getActiveMembership(
    String userId,
    String venueId,
  ) async {
    try {
      final snapshot = await _firestore
          .collection('memberships')
          .where('userId', isEqualTo: userId)
          .where('venueId', isEqualTo: venueId)
          .where('status', isEqualTo: 'Active')
          .get();

      if (snapshot.docs.isEmpty) return null;

      // Find the one that hasn't expired
      for (final doc in snapshot.docs) {
        final membership = Membership.fromFirestore(doc.id, doc.data());
        if (membership.isActive) {
          return membership;
        }
      }

      return null;
    } catch (e) {
      debugPrint('Error fetching active membership: $e');
      return null;
    }
  }

  // ==================== ORDERS ====================
  static Stream<List<order_model.Order>> getUserOrdersStream(String userId) {
    return _firestore
        .collection('orders')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => order_model.Order.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<order_model.Order>> getUserOrders(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('orders')
          .where('userId', isEqualTo: userId)
          .orderBy('createdAt', descending: true)
          .get();
      return snapshot.docs
          .map((doc) => order_model.Order.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching orders: $e');
      return [];
    }
  }

  static Future<String> createOrder(Map<String, dynamic> orderData) async {
    try {
      // Generate order number
      final orderNumber = 'ORD-${DateTime.now().millisecondsSinceEpoch}';

      final docRef = await _firestore.collection('orders').add({
        ...orderData,
        'orderNumber': orderNumber,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      debugPrint('Error creating order: $e');
      rethrow;
    }
  }

  static Future<void> updateOrder(
    String orderId,
    Map<String, dynamic> updates,
  ) async {
    try {
      await _firestore.collection('orders').doc(orderId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error updating order: $e');
      rethrow;
    }
  }

  static Future<void> updateProductInventory(
    String productId,
    int quantitySold,
  ) async {
    try {
      final productRef = _firestore.collection('products').doc(productId);
      await _firestore.runTransaction((transaction) async {
        final productDoc = await transaction.get(productRef);
        if (productDoc.exists) {
          final data = productDoc.data() as Map<String, dynamic>;
          final currentStock = data['stock'] as int? ?? 0;
          if (quantitySold > currentStock) {
            throw Exception(
              'Insufficient stock: requested $quantitySold, available $currentStock',
            );
          }
          final newStock = currentStock - quantitySold;

          String newStatus = 'In Stock';
          if (newStock <= 0) {
            newStatus = 'Out of Stock';
          } else if (newStock < 10) {
            newStatus = 'Low Stock';
          }

          transaction.update(productRef, {
            'stock': newStock,
            'status': newStatus,
            'updatedAt': FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (e) {
      debugPrint('Error updating product inventory: $e');
      rethrow;
    }
  }

  // ==================== PRODUCTS ====================
  static Stream<List<Product>> getProductsStream() {
    return _firestore
        .collection('products')
        .where('status', whereIn: ['In Stock', 'Low Stock'])
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => Product.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<Product>> getProducts() async {
    try {
      final snapshot = await _firestore
          .collection('products')
          .where('status', whereIn: ['In Stock', 'Low Stock'])
          .get();
      return snapshot.docs
          .map((doc) => Product.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching products: $e');
      return [];
    }
  }

  static Future<List<Product>> getProductsByCategory(String categoryId) async {
    try {
      final snapshot = await _firestore
          .collection('products')
          .where('category', isEqualTo: categoryId)
          .where('status', whereIn: ['In Stock', 'Low Stock'])
          .get();
      return snapshot.docs
          .map((doc) => Product.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching products by category: $e');
      return [];
    }
  }

  static Future<Product?> getProductById(String productId) async {
    try {
      final doc = await _firestore.collection('products').doc(productId).get();
      if (doc.exists) {
        return Product.fromFirestore(doc.id, doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching product: $e');
      return null;
    }
  }

  // ==================== TEAMS ====================
  static Stream<List<Team>> getUserTeamsStream(String userId) {
    return _firestore
        .collection('teams')
        .where('members', arrayContains: userId)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => Team.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<Team>> getUserTeams(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('teams')
          .where('members', arrayContains: userId)
          .get();
      return snapshot.docs
          .map((doc) => Team.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching teams: $e');
      return [];
    }
  }

  static Future<String> createTeam(Map<String, dynamic> teamData) async {
    try {
      final docRef = await _firestore.collection('teams').add({
        ...teamData,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      debugPrint('Error creating team: $e');
      rethrow;
    }
  }

  // ==================== SOCIAL FEED ====================
  static const int feedPageSize = 20;

  static Stream<List<MatchFeedItem>> getFeedItemsStream() {
    return _firestore
        .collection('posts')
        .where('status', isEqualTo: 'Approved')
        .orderBy('createdAt', descending: true)
        .limit(feedPageSize)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map((doc) => MatchFeedItem.fromFirestore(doc.id, doc.data()))
              .toList(),
        );
  }

  static Future<List<MatchFeedItem>> getFeedItems({
    int limit = 20,
    DocumentSnapshot<Map<String, dynamic>>? startAfter,
  }) async {
    // Guard against runaway limits
    final safeLimit = limit.clamp(1, 100);
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection('posts')
          .where('status', isEqualTo: 'Approved')
          .orderBy('createdAt', descending: true)
          .limit(safeLimit);

      if (startAfter != null) {
        query = query.startAfterDocument(startAfter);
      }

      final snapshot = await query.get();
      return snapshot.docs
          .map((doc) => MatchFeedItem.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching feed items: $e');
      return [];
    }
  }

  static Future<String> createPost({
    required String userId,
    required String userName,
    required String content,
    String? imageUrl,
    String? venueId,
  }) async {
    try {
      final docRef = await _firestore.collection('posts').add({
        'userId': userId,
        'userName': userName,
        'content': content,
        if (imageUrl != null) 'imageUrl': imageUrl,
        'venueId': venueId,
        'status': 'Pending',
        'likes': 0,
        'comments': 0,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      debugPrint('Error creating post: $e');
      rethrow;
    }
  }

  // ==================== USER PROFILE ====================
  static Future<Map<String, dynamic>?> getUserProfile(String userId) async {
    try {
      final doc = await _firestore.collection('users').doc(userId).get();
      if (doc.exists) {
        return _sanitizeUserProfile(doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching user profile: $e');
      return null;
    }
  }

  /// Strip admin-only fields before exposing profile data in the mobile app.
  static Map<String, dynamic> _sanitizeUserProfile(Map<String, dynamic> data) {
    final sanitized = Map<String, dynamic>.from(data);
    const adminOnlyKeys = {
      'managedVenues',
      'venueName',
      'salary',
      'department',
      'pincode',
    };
    for (final key in adminOnlyKeys) {
      sanitized.remove(key);
    }
    return sanitized;
  }

  /// Strip internal venue admin fields — mobile only needs customer-facing data.
  static Map<String, dynamic> sanitizeVenueData(Map<String, dynamic> data) {
    final sanitized = Map<String, dynamic>.from(data);
    const adminOnlyKeys = {
      'paymentSettings',
      'managerId',
      'staffIds',
      'userIds',
    };
    for (final key in adminOnlyKeys) {
      sanitized.remove(key);
    }
    if (sanitized['courts'] is List) {
      sanitized['courts'] = (sanitized['courts'] as List).map((court) {
        if (court is! Map) return court;
        return Map<String, dynamic>.from(court);
      }).toList();
    }
    return sanitized;
  }

  static Future<void> updateUserProfile(
    String userId,
    Map<String, dynamic> updates,
  ) async {
    try {
      await _firestore.collection('users').doc(userId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error updating user profile: $e');
      rethrow;
    }
  }

  static Future<void> createWalletTransaction({
    required String userId,
    required String type, // 'Credit' or 'Debit'
    required double amount,
    required String description,
    required double balanceAfter,
  }) async {
    try {
      await _firestore.collection('walletTransactions').add({
        'userId': userId,
        'type': type,
        'amount': amount,
        'description': description,
        'balanceAfter': balanceAfter,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error creating wallet transaction: $e');
      rethrow;
    }
  }

  // ==================== NOTIFICATIONS ====================
  static Stream<List<Map<String, dynamic>>> getUserNotificationsStream(
    String userId,
  ) {
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs.map((doc) {
            final data = doc.data();
            return {'id': doc.id, ...data};
          }).toList(),
        );
  }

  static Future<void> markNotificationAsRead(String notificationId) async {
    try {
      await _firestore.collection('notifications').doc(notificationId).update({
        'read': true,
        'readAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  // ==================== SPORTS ====================
  static Future<List<Map<String, dynamic>>> getSports() async {
    try {
      final snapshot = await _firestore
          .collection('sports')
          .where('isActive', isEqualTo: true)
          .orderBy('order')
          .get();
      return snapshot.docs.map((doc) {
        final data = doc.data();
        return {'id': doc.id, ...data};
      }).toList();
    } catch (e) {
      debugPrint('Error fetching sports: $e');
      return [];
    }
  }

  // ==================== CATEGORIES ====================
  static Future<List<Map<String, dynamic>>> getCategories() async {
    try {
      final snapshot = await _firestore
          .collection('categories')
          .where('isActive', isEqualTo: true)
          .orderBy('order')
          .get();
      return snapshot.docs.map((doc) {
        final data = doc.data();
        return {'id': doc.id, ...data};
      }).toList();
    } catch (e) {
      debugPrint('Error fetching categories: $e');
      return [];
    }
  }

  // ==================== FAVORITES ====================
  /// Toggle favorite status for a venue
  static Future<void> toggleFavoriteVenue(String userId, String venueId) async {
    try {
      final favoriteRef = _firestore
          .collection('users')
          .doc(userId)
          .collection('favorites')
          .doc(venueId);

      await _firestore.runTransaction((transaction) async {
        final favoriteDoc = await transaction.get(favoriteRef);

        if (favoriteDoc.exists) {
          // Remove from favorites
          transaction.delete(favoriteRef);
        } else {
          // Add to favorites
          transaction.set(favoriteRef, {
            'venueId': venueId,
            'createdAt': FieldValue.serverTimestamp(),
          });
        }
      });
    } catch (e) {
      debugPrint('Error toggling favorite: $e');
      rethrow;
    }
  }

  /// Check if a venue is favorited by user
  static Future<bool> isVenueFavorited(String userId, String venueId) async {
    try {
      final favoriteDoc = await _firestore
          .collection('users')
          .doc(userId)
          .collection('favorites')
          .doc(venueId)
          .get();
      return favoriteDoc.exists;
    } catch (e) {
      debugPrint('Error checking favorite: $e');
      return false;
    }
  }

  /// Get stream of user's favorite venue IDs
  static Stream<List<String>> getUserFavoritesStream(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('favorites')
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) => doc.id).toList());
  }

  /// Get list of user's favorite venue IDs
  static Future<List<String>> getUserFavorites(String userId) async {
    try {
      final snapshot = await _firestore
          .collection('users')
          .doc(userId)
          .collection('favorites')
          .get();
      return snapshot.docs.map((doc) => doc.id).toList();
    } catch (e) {
      debugPrint('Error fetching favorites: $e');
      return [];
    }
  }

  // ==================== PLATFORM SETTINGS ====================
  static Future<Map<String, dynamic>> getPlatformSettings() async {
    try {
      final doc = await _firestore
          .collection('appSettings')
          .doc('platform')
          .get();
      if (doc.exists) {
        return doc.data()!;
      }
      return {'convenienceFee': 100.0, 'platformCommission': 0.05};
    } catch (e) {
      debugPrint('Error fetching platform settings: $e');
      return {'convenienceFee': 100.0, 'platformCommission': 0.05};
    }
  }

  // ==================== ENGAGEMENT (vendor content for players) ====================

  static Future<List<QuickMatch>> getOpenQuickMatches({String? venueId}) async {
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection('quickMatches')
          .where('status', whereIn: ['Open', 'Full']);
      if (venueId != null && venueId.isNotEmpty) {
        query = query.where('venueId', isEqualTo: venueId);
      }
      final snapshot = await query.limit(50).get();
      final matches = snapshot.docs
          .map((doc) => QuickMatch.fromFirestore(doc.id, doc.data()))
          .toList();
      matches.sort((a, b) {
        final ad = a.date ?? DateTime(1970);
        final bd = b.date ?? DateTime(1970);
        return ad.compareTo(bd);
      });
      return matches;
    } catch (e) {
      debugPrint('Error fetching quick matches: $e');
      return [];
    }
  }

  static Future<void> joinQuickMatch(String matchId, String userId) async {
    final ref = _firestore.collection('quickMatches').doc(matchId);
    await _firestore.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) throw Exception('Match not found');
      final data = snap.data()!;
      final playerIds = List<String>.from(
        data['playerIds'] as List? ?? const [],
      );
      if (playerIds.contains(userId)) return;
      final maxPlayers = (data['maxPlayers'] as num?)?.toInt() ?? 0;
      if (playerIds.length >= maxPlayers) throw Exception('Match is full');
      playerIds.add(userId);
      tx.update(ref, {
        'playerIds': playerIds,
        'currentPlayers': playerIds.length,
        'status': playerIds.length >= maxPlayers ? 'Full' : 'Open',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  static Future<List<TournamentSummary>> getOpenTournaments({
    String? venueId,
  }) async {
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection('tournaments')
          .where('status', whereIn: ['Open', 'Registration Closed', 'Ongoing']);
      if (venueId != null && venueId.isNotEmpty) {
        query = query.where('venueId', isEqualTo: venueId);
      }
      final snapshot = await query.limit(40).get();
      return snapshot.docs
          .map((doc) => TournamentSummary.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching tournaments: $e');
      return [];
    }
  }

  static Future<List<AppPoll>> getActivePolls({String? venueId}) async {
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection('polls')
          .where('status', isEqualTo: 'Active');
      if (venueId != null && venueId.isNotEmpty) {
        query = query.where('venueId', isEqualTo: venueId);
      }
      final snapshot = await query.limit(30).get();
      return snapshot.docs
          .map((doc) => AppPoll.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching polls: $e');
      return [];
    }
  }

  static Future<void> votePoll({
    required String pollId,
    required String optionId,
    required String userId,
  }) async {
    final ref = _firestore.collection('polls').doc(pollId);
    await _firestore.runTransaction((tx) async {
      final snap = await tx.get(ref);
      if (!snap.exists) throw Exception('Poll not found');
      final data = snap.data()!;
      if (data['status'] != 'Active') throw Exception('Poll is closed');
      final voted = List<String>.from(
        data['votedUserIds'] as List? ?? const [],
      );
      if (voted.contains(userId)) throw Exception('You already voted');
      final options = List<Map<String, dynamic>>.from(
        (data['options'] as List? ?? const []).map(
          (o) => Map<String, dynamic>.from(o as Map),
        ),
      );
      final idx = options.indexWhere((o) => o['id'] == optionId);
      if (idx < 0) throw Exception('Option not found');
      options[idx]['votes'] =
          ((options[idx]['votes'] as num?)?.toInt() ?? 0) + 1;
      voted.add(userId);
      tx.update(ref, {
        'options': options,
        'totalVotes': ((data['totalVotes'] as num?)?.toInt() ?? 0) + 1,
        'votedUserIds': voted,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  static Future<List<FlashDealItem>> getActiveFlashDeals({
    String? venueId,
  }) async {
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection('flashDeals')
          .where('status', isEqualTo: 'Active');
      if (venueId != null && venueId.isNotEmpty) {
        query = query.where('venueId', isEqualTo: venueId);
      }
      final snapshot = await query.limit(30).get();
      return snapshot.docs
          .map((doc) => FlashDealItem.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching flash deals: $e');
      return [];
    }
  }

  static Future<List<MarketingCampaignItem>> getLiveCampaigns() async {
    try {
      final snapshot = await _firestore
          .collection('marketingCampaigns')
          .where('status', isEqualTo: 'Live')
          .limit(20)
          .get();
      return snapshot.docs
          .map((doc) => MarketingCampaignItem.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching marketing campaigns: $e');
      return [];
    }
  }

  static Future<List<AppLeaderboard>> getLeaderboards({String? venueId}) async {
    try {
      Query<Map<String, dynamic>> query = _firestore.collection('leaderboards');
      if (venueId != null && venueId.isNotEmpty) {
        query = query.where('venueId', isEqualTo: venueId);
      }
      final snapshot = await query.limit(20).get();
      return snapshot.docs
          .map((doc) => AppLeaderboard.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching leaderboards: $e');
      return [];
    }
  }
}
