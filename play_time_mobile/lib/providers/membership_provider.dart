import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/membership_plan.dart';
import '../models/membership.dart';
import '../services/firestore_service.dart';

class MembershipProvider with ChangeNotifier {
  List<MembershipPlan> _plans = [];
  List<Membership> _memberships = [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription<List<MembershipPlan>>? _plansSubscription;
  StreamSubscription<List<Membership>>? _membershipsSubscription;

  List<MembershipPlan> get plans => _plans;

  /// Play Time Pro plans only (player membership — not vendor subscriptions).
  List<MembershipPlan> get platformPlans =>
      _plans.where((p) => p.isPlatformPlan).toList();

  /// Vendor subscription plans for a specific venue.
  List<MembershipPlan> venueSubscriptionPlans(String venueId) => _plans
      .where((p) => p.isVenueSubscription && p.venueId == venueId)
      .toList();

  List<Membership> get memberships => _memberships;
  bool get isLoading => _isLoading;
  String? get error => _error;

  MembershipProvider() {
    _loadPlans();
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadMemberships(user.uid);
    }

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
    _membershipsSubscription = FirestoreService.getUserMembershipsStream(userId)
        .listen(
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

      final plan = await FirestoreService.getMembershipPlanById(planId);
      if (plan == null) {
        throw Exception('Membership plan not found');
      }

      final now = DateTime.now();
      DateTime endDate;
      switch (plan.planType) {
        case 'Monthly':
          endDate = now.add(const Duration(days: 30));
          break;
        case '6 Months':
          endDate = now.add(const Duration(days: 180));
          break;
        case 'Annual':
          endDate = DateTime(now.year + 1, now.month, now.day);
          break;
        default:
          endDate = now.add(const Duration(days: 30));
      }

      final resolvedVenueId = plan.isPlatformPlan
          ? 'platform'
          : (venueId.trim().isNotEmpty ? venueId : (plan.venueId ?? ''));
      if (resolvedVenueId.isEmpty) {
        throw Exception('This plan is missing a venue assignment');
      }

      final membershipData = {
        'userId': user.uid,
        'venueId': resolvedVenueId,
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

      final membershipId = await FirestoreService.createMembership(
        membershipData,
      );
      await refreshMemberships();
      return membershipId;
    } catch (e) {
      _error = 'Failed to create membership: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> cancelPendingMembership(String membershipId) async {
    try {
      await FirestoreService.updateMembership(membershipId, {
        'status': 'Cancelled',
        'paymentStatus': 'Pending',
      });
      await refreshMemberships();
    } catch (_) {
      // Best-effort cleanup after payment failure
    }
  }

  Future<void> refreshMemberships() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadMemberships(user.uid);
    }
  }

  Membership? getActivePlatformMembership() {
    try {
      return _memberships.firstWhere((m) => m.isActive && m.isPlatformMembership);
    } catch (_) {
      return null;
    }
  }

  Membership? getActiveVenueSubscription(String venueId) {
    try {
      return _memberships.firstWhere(
        (m) => m.isActive && m.venueId == venueId,
      );
    } catch (_) {
      return null;
    }
  }

  /// When [venueId] is null: active Play Time Pro only.
  /// When set: active vendor subscription for that venue only.
  Membership? getActiveMembership(String? venueId) {
    if (venueId == null || venueId.isEmpty || venueId == 'platform') {
      return getActivePlatformMembership();
    }
    return getActiveVenueSubscription(venueId);
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
