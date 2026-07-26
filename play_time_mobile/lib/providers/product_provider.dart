import 'package:flutter/foundation.dart';
import '../models/product.dart';
import '../services/firestore_service.dart';

class ProductProvider with ChangeNotifier {
  List<Product> _products = [];
  List<Map<String, String>> _categories = const [];
  bool _isLoading = false;
  String? _error;

  List<Product> get products => _products;
  List<Map<String, String>> get categories => _categories;
  bool get isLoading => _isLoading;
  String? get error => _error;

  ProductProvider() {
    loadProducts();
  }

  Future<void> loadProducts() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final results = await Future.wait<Object>([
        FirestoreService.getProducts(),
        FirestoreService.getCategories(),
      ]);
      _products = results[0] as List<Product>;
      _categories = (results[1] as List<Map<String, dynamic>>)
          .map(
            (category) => {
              'id': category['id']?.toString() ?? '',
              'name':
                  category['name']?.toString() ??
                  category['title']?.toString() ??
                  '',
            },
          )
          .where(
            (category) =>
                category['id']!.isNotEmpty && category['name']!.isNotEmpty,
          )
          .toList();
    } catch (e) {
      _error = 'Failed to load products: $e';
      debugPrint('Error loading products: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshProducts() async {
    await loadProducts();
  }

  List<Product> getProductsByCategory(String categoryId) {
    return _products.where((p) => p.category == categoryId).toList();
  }

  Product? getProductById(String productId) {
    try {
      return _products.firstWhere((p) => p.id == productId);
    } catch (e) {
      return null;
    }
  }

  Stream<List<Product>> getProductsStream() {
    return FirestoreService.getProductsStream();
  }
}
