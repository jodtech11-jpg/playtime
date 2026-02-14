import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/membership_plan.dart';
import '../models/membership.dart';
import '../services/firestore_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class MembershipProvider with ChangeNotifier {
  List<MembershipPlan> _plans = [];
  List<Membership> _memberships = [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription<List<MembershipPlan>>? _plansSubscription;
  StreamSubscription<List<Membership>>? _membershipsSubscription;

  List<MembershipPlan> get plans => _plans;
  List<Membership> get memberships => _memberships;
  bool get isLoading => _isLoading;
  String? get error => _error;

  MembershipProvider() {
    _loadPlans();
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadMemberships(user.uid);
    }

    // Listen to auth state changes
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        _loadMemberships(user.uid);
      } else {
        _memberships = [];
        notifyListeners();
      }
    });
  }

  Future<void> loadMembershipPlans() async {
    _loadPlans();
  }

  void _loadPlans() {
    _isLoading = true;
    _error = null;
    notifyListeners();

    _plansSubscription?.cancel();
    _plansSubscription = FirestoreService.getMembershipPlansStream().listen(
      (plans) {
        _plans = plans;
        _isLoading = false;
        notifyListeners();
      },
      onError: (error) {
        _error = 'Failed to load membership plans: $error';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  void _loadMemberships(String userId) {
    _isLoading = true;
    _error = null;
    notifyListeners();

    _membershipsSubscription?.cancel();
    _membershipsSubscription = FirestoreService.getUserMembershipsStream(userId).listen(
      (memberships) {
        _memberships = memberships;
        _isLoading = false;
        notifyListeners();
      },
      onError: (error) {
        _error = 'Failed to load memberships: $error';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  Future<String> createMembership({
    required String planId,
    required String venueId,
    required double price,
  }) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Get plan details
      final plan = await FirestoreService.getMembershipPlanById(planId);
      if (plan == null) {
        throw Exception('Membership plan not found');
      }

      // Calculate dates based on plan type
      final now = DateTime.now();
      DateTime endDate;
      switch (plan.planType) {
        case 'Monthly':
          endDate = DateTime(now.year, now.month + 1, now.day);
          break;
        case '6 Months':
          endDate = DateTime(now.year, now.month + 6, now.day);
          break;
        case 'Annual':
          endDate = DateTime(now.year + 1, now.month, now.day);
          break;
        default:
          endDate = DateTime(now.year, now.month + 1, now.day);
      }

      final membershipData = {
        'userId': user.uid,
        'venueId': venueId,
        'planId': planId,
        'planName': plan.name,
        'planType': plan.planType,
        'price': price,
        'paymentStatus': 'Pending',
        'startDate': Timestamp.fromDate(now),
        'endDate': Timestamp.fromDate(endDate),
        'status': 'Pending',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      final membershipId = await FirestoreService.createMembership(membershipData);
      await refreshMemberships();
      return membershipId;
    } catch (e) {
      _error = 'Failed to create membership: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> refreshMemberships() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadMemberships(user.uid);
    }
  }

  Membership? getActiveMembership(String? venueId) {
    try {
      if (venueId != null) {
        return _memberships.firstWhere(
          (m) => m.venueId == venueId && m.isActive,
          orElse: () => _memberships.firstWhere(
            (m) => m.isActive,
            orElse: () => _memberships.first,
          ),
        );
      }
      return _memberships.firstWhere((m) => m.isActive);
    } catch (e) {
      return null;
    }
  }

  bool hasActiveMembership(String? venueId) {
    return getActiveMembership(venueId) != null;
  }

  @override
  void dispose() {
    _plansSubscription?.cancel();
    _membershipsSubscription?.cancel();
    super.dispose();
  }
}

