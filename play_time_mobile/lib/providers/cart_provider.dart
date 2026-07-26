import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/product.dart';
import '../services/firestore_service.dart';

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, this.quantity = 1});
}

class CartProvider with ChangeNotifier {
  final List<CartItem> _items = [];
  StreamSubscription<User?>? _authSubscription;
  String? _userId;
  bool _isRehydrating = false;

  bool get isRehydrating => _isRehydrating;

  CartProvider() {
    try {
      _authSubscription = FirebaseAuth.instance.authStateChanges().listen(
        _handleUser,
      );
      _handleUser(FirebaseAuth.instance.currentUser);
    } catch (_) {
      // Pure Dart/widget tests may construct the provider before Firebase.
    }
  }

  List<CartItem> get items => _items;

  Set<String> get venueIds => _items
      .map((item) => item.product.venueId)
      .whereType<String>()
      .where((id) => id.isNotEmpty)
      .toSet();

  bool get hasProductsWithoutVenue =>
      _items.any((item) => item.product.venueId?.isNotEmpty != true);

  bool get hasVenueScopedProducts => venueIds.isNotEmpty;

  /// True when cart mixes venue-owned and platform/global products.
  bool get hasMixedFulfilment =>
      hasVenueScopedProducts && hasProductsWithoutVenue;

  bool get isMultiVenue => venueIds.length > 1;

  /// Single fulfilment target for checkout: venue id, or `platform` for global products.
  /// Returns null when the cart cannot be fulfilled in one order.
  String? get fulfilmentVenueId {
    if (_items.isEmpty || isMultiVenue || hasMixedFulfilment) return null;
    if (venueIds.isEmpty) return 'platform';
    return venueIds.single;
  }

  String? get fulfilmentVenueName {
    final venueId = fulfilmentVenueId;
    if (venueId == null) return null;
    if (venueId == 'platform') return 'Play Time';
    for (final item in _items) {
      final name = item.product.venueName?.trim();
      if (name != null && name.isNotEmpty) return name;
    }
    return null;
  }

  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);

  double get total {
    final raw = _items.fold(
      0.0,
      (sum, item) => sum + (item.product.price * item.quantity),
    );
    return double.parse(raw.toStringAsFixed(2));
  }

  double get originalTotal {
    final raw = _items.fold(
      0.0,
      (sum, item) => sum + (item.product.originalPrice * item.quantity),
    );
    return double.parse(raw.toStringAsFixed(2));
  }

  double get discount {
    final savings = originalTotal - total;
    return savings > 0 ? double.parse(savings.toStringAsFixed(2)) : 0.0;
  }

  void addToCart(Product product) {
    if (product.isOutOfStock) {
      return;
    }
    final existingIndex = _items.indexWhere(
      (item) => item.product.id == product.id,
    );

    final maxQty = product.effectiveMaxQuantity;
    if (existingIndex >= 0) {
      final next = (_items[existingIndex].quantity + 1).clamp(1, maxQty);
      _items[existingIndex].quantity = next;
    } else {
      _items.add(CartItem(product: product, quantity: 1.clamp(1, maxQty)));
    }
    notifyListeners();
    unawaited(_persist());
  }

  void removeFromCart(String productId) {
    _items.removeWhere((item) => item.product.id == productId);
    notifyListeners();
    unawaited(_persist());
  }

  void updateQuantity(String productId, int quantity) {
    final index = _items.indexWhere((item) => item.product.id == productId);
    if (index >= 0) {
      final product = _items[index].product;
      if (product.isOutOfStock) {
        _items.removeAt(index);
        notifyListeners();
        return;
      }
      final maxQty = product.effectiveMaxQuantity;
      if (quantity <= 0) {
        _items.removeAt(index);
      } else {
        _items[index].quantity = quantity.clamp(1, maxQty);
      }
      notifyListeners();
      unawaited(_persist());
    }
  }

  void clearCart() {
    _items.clear();
    notifyListeners();
    unawaited(_persist());
  }

  bool isInCart(String productId) {
    return _items.any((item) => item.product.id == productId);
  }

  /// Replace cart line products with fresh Firestore data (venue/stock/price).
  void replaceProducts(Map<String, Product> productsById) {
    var changed = false;
    for (var i = 0; i < _items.length; i++) {
      final fresh = productsById[_items[i].product.id];
      if (fresh == null) continue;
      final quantity = _items[i].quantity.clamp(1, fresh.effectiveMaxQuantity);
      _items[i] = CartItem(product: fresh, quantity: quantity);
      changed = true;
    }
    if (changed) {
      notifyListeners();
      unawaited(_persist());
    }
  }

  String _storageKey(String userId) => 'cart_v1_$userId';

  Future<void> _handleUser(User? user) async {
    final nextUserId = user?.uid;
    if (nextUserId == _userId) return;
    _userId = nextUserId;
    _items.clear();
    notifyListeners();
    if (nextUserId == null) return;
    await _rehydrate(nextUserId);
  }

  Future<void> _rehydrate(String userId) async {
    _isRehydrating = true;
    notifyListeners();
    try {
      final preferences = await SharedPreferences.getInstance();
      final raw = preferences.getString(_storageKey(userId));
      if (raw == null || raw.isEmpty || _userId != userId) return;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;

      final restored = <CartItem>[];
      for (final line in decoded) {
        if (line is! Map) continue;
        final productId = line['productId']?.toString() ?? '';
        final quantity = (line['quantity'] as num?)?.toInt() ?? 0;
        if (productId.isEmpty || quantity <= 0) continue;
        final product = await FirestoreService.getProductById(productId);
        if (product == null || product.isOutOfStock || _userId != userId) {
          continue;
        }
        restored.add(
          CartItem(
            product: product,
            quantity: quantity.clamp(1, product.effectiveMaxQuantity),
          ),
        );
      }
      if (_userId == userId) {
        _items
          ..clear()
          ..addAll(restored);
      }
    } catch (error) {
      debugPrint('Could not restore cart: $error');
    } finally {
      if (_userId == userId) {
        _isRehydrating = false;
        notifyListeners();
        unawaited(_persist());
      }
    }
  }

  Future<void> _persist() async {
    final userId = _userId;
    if (userId == null || _isRehydrating) return;
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setString(
        _storageKey(userId),
        jsonEncode(
          _items
              .map(
                (item) => {
                  'productId': item.product.id,
                  'quantity': item.quantity,
                },
              )
              .toList(),
        ),
      );
    } catch (error) {
      debugPrint('Could not persist cart: $error');
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}
