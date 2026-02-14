import 'package:cloud_firestore/cloud_firestore.dart';
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

class FirestoreService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // ==================== VENUES ====================
  static Stream<List<Venue>> getVenuesStream() {
    return _firestore
        .collection('venues')
        .where('status', isEqualTo: 'Active')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => Venue.fromFirestore(doc.id, doc.data()))
            .toList());
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
      print('Error fetching venues: $e');
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
      print('Error fetching venue: $e');
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
      print('Error fetching venues by sport: $e');
      return [];
    }
  }

  static Future<List<Venue>> getNearbyVenues(
      double latitude, double longitude, double radiusKm) async {
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
      print('Error fetching nearby venues: $e');
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
        .map((snapshot) => snapshot.docs
            .map((doc) => Booking.fromFirestore(doc.id, doc.data()))
            .toList());
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
      print('Error fetching bookings: $e');
      return [];
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
      print('Error creating booking: $e');
      rethrow;
    }
  }

  static Future<void> updateBooking(
      String bookingId, Map<String, dynamic> updates) async {
    try {
      await _firestore.collection('bookings').doc(bookingId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print('Error updating booking: $e');
      rethrow;
    }
  }

  static Future<void> cancelBooking(String bookingId) async {
    try {
      await _firestore.collection('bookings').doc(bookingId).update({
        'status': 'Cancelled',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print('Error cancelling booking: $e');
      rethrow;
    }
  }

  // ==================== COURTS ====================
  static Future<List<Court>> getCourtsByVenue(String venueId) async {
    try {
      final snapshot = await _firestore
          .collection('courts')
          .where('venueId', isEqualTo: venueId)
          .where('status', isEqualTo: 'Active')
          .get();
      return snapshot.docs
          .map((doc) => Court.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      print('Error fetching courts: $e');
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
      print('Error fetching court: $e');
      return null;
    }
  }

  static Stream<List<Court>> getCourtsByVenueStream(String venueId) {
    return _firestore
        .collection('courts')
        .where('venueId', isEqualTo: venueId)
        .where('status', isEqualTo: 'Active')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => Court.fromFirestore(doc.id, doc.data()))
            .toList());
  }

  // ==================== AVAILABILITY CHECKING ====================
  /// Check if a time slot is available for a court
  static Future<bool> isSlotAvailable({
    required String venueId,
    required String courtId,
    required DateTime startTime,
    required DateTime endTime,
  }) async {
    try {
      // Check for conflicting bookings
      final conflicts = await _firestore
          .collection('bookings')
          .where('venueId', isEqualTo: venueId)
          .where('courtId', isEqualTo: courtId)
          .where('status', whereIn: ['Pending', 'Confirmed'])
          .get();

      for (final doc in conflicts.docs) {
        final data = doc.data();
        final bookingStart = (data['startTime'] as Timestamp).toDate();
        final bookingEnd = (data['endTime'] as Timestamp).toDate();

        // Check for time overlap
        if (startTime.isBefore(bookingEnd) && endTime.isAfter(bookingStart)) {
          return false; // Conflict found
        }
      }

      // Check court availability schedule
      final court = await getCourtById(courtId);
      if (court == null) return false;

      // Get day name
      final days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      final dayName = days[startTime.weekday - 1];

      // Check if court is available on this day
      if (!court.isAvailableOnDay(dayName)) {
        return false;
      }

      // Check if time slot is within court's availability hours
      final dayAvailability = court.getAvailabilityForDay(dayName);
      if (dayAvailability == null) return false;

      final (startHour, startMinute) = dayAvailability.parseTime(dayAvailability.start);
      final (endHour, endMinute) = dayAvailability.parseTime(dayAvailability.end);

      final slotStartMinutes = startTime.hour * 60 + startTime.minute;
      final slotEndMinutes = endTime.hour * 60 + endTime.minute;
      final courtStartMinutes = startHour * 60 + startMinute;
      final courtEndMinutes = endHour * 60 + endMinute;

      // Check if slot is within court availability hours
      if (slotStartMinutes < courtStartMinutes || slotEndMinutes > courtEndMinutes) {
        return false;
      }

      return true;
    } catch (e) {
      print('Error checking slot availability: $e');
      return false;
    }
  }

  /// Generate available time slots for a court on a specific date
  static Future<List<Map<String, dynamic>>> getAvailableTimeSlots({
    required String venueId,
    required String courtId,
    required DateTime date,
  }) async {
    try {
      final court = await getCourtById(courtId);
      if (court == null) return [];

      // Get day name
      final days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      final dayName = days[date.weekday - 1];

      // Check if court is available on this day
      if (!court.isAvailableOnDay(dayName)) {
        return [];
      }

      final dayAvailability = court.getAvailabilityForDay(dayName);
      if (dayAvailability == null) return [];

      // Parse availability times
      final (startHour, startMinute) = dayAvailability.parseTime(dayAvailability.start);
      final (endHour, endMinute) = dayAvailability.parseTime(dayAvailability.end);

      // Get existing bookings for this date
      final startOfDay = DateTime(date.year, date.month, date.day, 0, 0);
      final endOfDay = DateTime(date.year, date.month, date.day, 23, 59);

      final bookings = await _firestore
          .collection('bookings')
          .where('venueId', isEqualTo: venueId)
          .where('courtId', isEqualTo: courtId)
          .where('startTime', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay))
          .where('startTime', isLessThanOrEqualTo: Timestamp.fromDate(endOfDay))
          .where('status', whereIn: ['Pending', 'Confirmed'])
          .get();

      // Create set of booked time slots
      final bookedSlots = <String>{};
      for (final doc in bookings.docs) {
        final data = doc.data();
        final bookingStart = (data['startTime'] as Timestamp).toDate();
        final hour = bookingStart.hour;
        final minute = bookingStart.minute;
        bookedSlots.add('${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}');
      }

      // Generate time slots (hourly slots)
      final slots = <Map<String, dynamic>>[];
      for (int hour = startHour; hour < endHour; hour++) {
        final timeStr = '${hour.toString().padLeft(2, '0')}:${startMinute.toString().padLeft(2, '0')}';
        final slotKey = '${hour.toString().padLeft(2, '0')}:${startMinute.toString().padLeft(2, '0')}';
        
        // Format for display (12-hour format)
        final period = hour >= 12 ? 'PM' : 'AM';
        final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
        final displayTime = '$displayHour:${startMinute.toString().padLeft(2, '0')} $period';

        final isAvailable = !bookedSlots.contains(slotKey);

        slots.add({
          'id': 'slot_$hour\_$startMinute',
          'time': displayTime,
          'time24': timeStr,
          'hour': hour,
          'minute': startMinute,
          'available': isAvailable,
        });
      }

      return slots;
    } catch (e) {
      print('Error generating time slots: $e');
      return [];
    }
  }

  /// Create booking with transaction to prevent conflicts
  static Future<String> createBookingWithTransaction(Map<String, dynamic> bookingData) async {
    try {
      return await _firestore.runTransaction((transaction) async {
        final venueId = bookingData['venueId'] as String;
        final courtId = bookingData['courtId'] as String;
        final startTime = (bookingData['startTime'] as Timestamp).toDate();
        final endTime = (bookingData['endTime'] as Timestamp).toDate();

        // Check for conflicts within transaction
        final conflicts = await _firestore
            .collection('bookings')
            .where('venueId', isEqualTo: venueId)
            .where('courtId', isEqualTo: courtId)
            .where('status', whereIn: ['Pending', 'Confirmed'])
            .get();

        for (final doc in conflicts.docs) {
          final data = doc.data();
          final bookingStart = (data['startTime'] as Timestamp).toDate();
          final bookingEnd = (data['endTime'] as Timestamp).toDate();

          // Check for time overlap
          if (startTime.isBefore(bookingEnd) && endTime.isAfter(bookingStart)) {
            throw Exception('Time slot is already booked. Please select another time.');
          }
        }

        // Create booking within transaction
        final docRef = _firestore.collection('bookings').doc();
        transaction.set(docRef, {
          ...bookingData,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });

        return docRef.id;
      });
    } catch (e) {
      print('Error creating booking with transaction: $e');
      rethrow;
    }
  }

  // ==================== MEMBERSHIP PLANS ====================
  static Stream<List<MembershipPlan>> getMembershipPlansStream({String? venueId}) {
    Query query = _firestore
        .collection('membershipPlans')
        .where('isActive', isEqualTo: true);

    if (venueId != null) {
      query = query.where('venueId', isEqualTo: venueId);
    }

    return query.snapshots().map((snapshot) => snapshot.docs
        .map((doc) => MembershipPlan.fromFirestore(doc.id, doc.data() as Map<String, dynamic>))
        .toList());
  }

  static Future<List<MembershipPlan>> getMembershipPlans({String? venueId}) async {
    try {
      Query query = _firestore
          .collection('membershipPlans')
          .where('isActive', isEqualTo: true);

      if (venueId != null) {
        query = query.where('venueId', isEqualTo: venueId);
      }

      final snapshot = await query.get();
      return snapshot.docs
          .map((doc) => MembershipPlan.fromFirestore(doc.id, doc.data() as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error fetching membership plans: $e');
      return [];
    }
  }

  static Future<MembershipPlan?> getMembershipPlanById(String planId) async {
    try {
      final doc = await _firestore.collection('membershipPlans').doc(planId).get();
      if (doc.exists) {
        return MembershipPlan.fromFirestore(doc.id, doc.data()!);
      }
      return null;
    } catch (e) {
      print('Error fetching membership plan: $e');
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
        .map((snapshot) => snapshot.docs
            .map((doc) => Membership.fromFirestore(doc.id, doc.data()))
            .toList());
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
      print('Error fetching memberships: $e');
      return [];
    }
  }

  static Future<String> createMembership(Map<String, dynamic> membershipData) async {
    try {
      final docRef = await _firestore.collection('memberships').add({
        ...membershipData,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      print('Error creating membership: $e');
      rethrow;
    }
  }

  static Future<void> updateMembership(
      String membershipId, Map<String, dynamic> updates) async {
    try {
      await _firestore.collection('memberships').doc(membershipId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print('Error updating membership: $e');
      rethrow;
    }
  }

  static Future<Membership?> getActiveMembership(String userId, String venueId) async {
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
      print('Error fetching active membership: $e');
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
        .map((snapshot) => snapshot.docs
            .map((doc) => order_model.Order.fromFirestore(doc.id, doc.data()))
            .toList());
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
      print('Error fetching orders: $e');
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
      print('Error creating order: $e');
      rethrow;
    }
  }

  static Future<void> updateOrder(
      String orderId, Map<String, dynamic> updates) async {
    try {
      await _firestore.collection('orders').doc(orderId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print('Error updating order: $e');
      rethrow;
    }
  }

  static Future<void> updateProductInventory(String productId, int quantitySold) async {
    try {
      final productRef = _firestore.collection('products').doc(productId);
      await _firestore.runTransaction((transaction) async {
        final productDoc = await transaction.get(productRef);
        if (productDoc.exists) {
          final data = productDoc.data() as Map<String, dynamic>;
          final currentStock = data['stock'] as int? ?? 0;
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
      print('Error updating product inventory: $e');
      rethrow;
    }
  }

  // ==================== PRODUCTS ====================
  static Stream<List<Product>> getProductsStream() {
    return _firestore
        .collection('products')
        .where('status', whereIn: ['In Stock', 'Low Stock'])
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => Product.fromFirestore(doc.id, doc.data()))
            .toList());
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
      print('Error fetching products: $e');
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
      print('Error fetching products by category: $e');
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
      print('Error fetching product: $e');
      return null;
    }
  }

  // ==================== TEAMS ====================
  static Stream<List<Team>> getUserTeamsStream(String userId) {
    return _firestore
        .collection('teams')
        .where('members', arrayContains: userId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => Team.fromFirestore(doc.id, doc.data()))
            .toList());
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
      print('Error fetching teams: $e');
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
      print('Error creating team: $e');
      rethrow;
    }
  }

  // ==================== SOCIAL FEED ====================
  static Stream<List<MatchFeedItem>> getFeedItemsStream() {
    return _firestore
        .collection('posts')
        .where('status', isEqualTo: 'Approved')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => MatchFeedItem.fromFirestore(doc.id, doc.data()))
            .toList());
  }

  static Future<List<MatchFeedItem>> getFeedItems({
    int limit = 20,
    DocumentSnapshot<Map<String, dynamic>>? startAfter,
  }) async {
    try {
      Query<Map<String, dynamic>> query = _firestore
          .collection('posts')
          .where('status', isEqualTo: 'Approved')
          .orderBy('createdAt', descending: true)
          .limit(limit);
      
      if (startAfter != null) {
        query = query.startAfterDocument(startAfter);
      }
      
      final snapshot = await query.get();
      return snapshot.docs
          .map((doc) => MatchFeedItem.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      print('Error fetching feed items: $e');
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
        'status': 'Approved', // Auto-approve for testing, changed from Pending
        'likes': 0,
        'comments': 0,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      print('Error creating post: $e');
      rethrow;
    }
  }

  // ==================== USER PROFILE ====================
  static Future<Map<String, dynamic>?> getUserProfile(String userId) async {
    try {
      final doc = await _firestore.collection('users').doc(userId).get();
      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (e) {
      print('Error fetching user profile: $e');
      return null;
    }
  }

  static Future<void> updateUserProfile(
      String userId, Map<String, dynamic> updates) async {
    try {
      await _firestore.collection('users').doc(userId).update({
        ...updates,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print('Error updating user profile: $e');
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
      print('Error creating wallet transaction: $e');
      rethrow;
    }
  }


  // ==================== NOTIFICATIONS ====================
  static Stream<List<Map<String, dynamic>>> getUserNotificationsStream(
      String userId) {
    return _firestore
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) {
              final data = doc.data();
              return {'id': doc.id, ...data};
            }).toList());
  }

  static Future<void> markNotificationAsRead(String notificationId) async {
    try {
      await _firestore.collection('notifications').doc(notificationId).update({
        'read': true,
        'readAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      print('Error marking notification as read: $e');
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
      print('Error fetching sports: $e');
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
      print('Error fetching categories: $e');
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
      print('Error toggling favorite: $e');
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
      print('Error checking favorite: $e');
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
      print('Error fetching favorites: $e');
      return [];
    }
  }

  // ==================== PLATFORM SETTINGS ====================
  static Future<Map<String, dynamic>> getPlatformSettings() async {
    try {
      final doc = await _firestore.collection('appSettings').doc('platform').get();
      if (doc.exists) {
        return doc.data()!;
      }
      return {
        'convenienceFee': 100.0,
        'platformCommission': 0.05,
      };
    } catch (e) {
      print('Error fetching platform settings: $e');
      return {
        'convenienceFee': 100.0,
        'platformCommission': 0.05,
      };
    }
  }
}

