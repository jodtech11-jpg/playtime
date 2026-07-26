import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models/order.dart';
import '../services/firestore_service.dart';

class OrderProvider with ChangeNotifier {
  List<Order> _orders = const [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription<User?>? _authSubscription;
  StreamSubscription<List<Order>>? _ordersSubscription;

  List<Order> get orders => List.unmodifiable(_orders);
  bool get isLoading => _isLoading;
  String? get error => _error;

  OrderProvider() {
    _authSubscription = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user == null) {
        _ordersSubscription?.cancel();
        _orders = const [];
        _isLoading = false;
        _error = null;
        notifyListeners();
      } else {
        _listen(user.uid);
      }
    });
  }

  void _listen(String userId) {
    _ordersSubscription?.cancel();
    _isLoading = true;
    _error = null;
    notifyListeners();
    _ordersSubscription = FirestoreService.getUserOrdersStream(userId).listen(
      (orders) {
        _orders = orders;
        _isLoading = false;
        notifyListeners();
      },
      onError: (Object error) {
        _error = 'Could not load orders. Pull to refresh and try again.';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  Order? byId(String id) {
    for (final order in _orders) {
      if (order.id == id) return order;
    }
    return null;
  }

  Future<void> refresh() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    try {
      _orders = await FirestoreService.getUserOrders(user.uid);
      _error = null;
    } catch (_) {
      _error = 'Could not refresh orders.';
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    _ordersSubscription?.cancel();
    super.dispose();
  }
}
