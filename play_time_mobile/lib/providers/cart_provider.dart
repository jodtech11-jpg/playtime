import 'package:flutter/foundation.dart';
import '../models/product.dart';

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, this.quantity = 1});
}

class CartProvider with ChangeNotifier {
  final List<CartItem> _items = [];

  List<CartItem> get items => _items;

  Set<String> get venueIds => _items
      .map((item) => item.product.venueId)
      .whereType<String>()
      .where((id) => id.isNotEmpty)
      .toSet();

  bool get hasProductsWithoutVenue =>
      _items.any((item) => item.product.venueId?.isNotEmpty != true);

  bool get isMultiVenue => venueIds.length > 1;

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

  double get discount => originalTotal - total;

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
  }

  void removeFromCart(String productId) {
    _items.removeWhere((item) => item.product.id == productId);
    notifyListeners();
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
    }
  }

  void clearCart() {
    _items.clear();
    notifyListeners();
  }

  bool isInCart(String productId) {
    return _items.any((item) => item.product.id == productId);
  }
}
