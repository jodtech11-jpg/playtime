class Product {
  final String id;
  final String name;
  final String brand;
  final double price;
  final double originalPrice;
  final String image;
  final String? tag;
  final String? category;

  /// Vendor venue that owns and fulfils this product.
  final String? venueId;
  final String? venueName;

  /// Firestore `status` (e.g. In Stock, Low Stock, Out of Stock).
  final String? status;

  /// Available units; null means unknown (treat as in stock for legacy docs).
  final int? stock;

  Product({
    required this.id,
    required this.name,
    required this.brand,
    required this.price,
    required this.originalPrice,
    required this.image,
    this.tag,
    this.category,
    this.venueId,
    this.venueName,
    this.status,
    this.stock,
  });

  bool get isOutOfStock =>
      status == 'Out of Stock' || (stock != null && stock! <= 0);

  int get effectiveMaxQuantity {
    if (stock == null) return 999;
    return stock! < 1 ? 0 : stock!;
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String? ?? '',
      price: (json['price'] as num).toDouble(),
      originalPrice:
          (json['originalPrice'] as num?)?.toDouble() ??
          (json['price'] as num).toDouble(),
      image: json['image'] as String? ?? (json['images'] as List?)?.first ?? '',
      tag: json['tag'] as String?,
      category: json['category'] as String?,
      venueId: json['venueId'] as String?,
      venueName: json['venueName'] as String?,
      status: json['status'] as String?,
      stock: json['stock'] != null ? (json['stock'] as num).toInt() : null,
    );
  }

  factory Product.fromFirestore(String id, Map<String, dynamic> data) {
    final images = data['images'] as List<dynamic>?;
    final originalPrice = data['originalPrice'] as num?;
    final price = (data['price'] as num).toDouble();

    return Product(
      id: id,
      name: data['name'] as String? ?? '',
      brand: data['brand'] as String? ?? '',
      price: price,
      originalPrice: originalPrice != null ? originalPrice.toDouble() : price,
      image: images != null && images.isNotEmpty ? images.first as String : '',
      tag: data['tag'] as String? ?? (data['tags'] as List?)?.first,
      category: data['category'] as String?,
      venueId: data['venueId'] as String?,
      venueName: data['venueName'] as String?,
      status: data['status'] as String?,
      stock: data['stock'] != null ? (data['stock'] as num).toInt() : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'brand': brand,
      'price': price,
      'originalPrice': originalPrice,
      'image': image,
      'tag': tag,
      'category': category,
      'venueId': venueId,
      'venueName': venueName,
      'status': status,
      'stock': stock,
    };
  }

  double get discountPercentage {
    if (originalPrice > price) {
      return ((originalPrice - price) / originalPrice * 100).roundToDouble();
    }
    return 0;
  }
}
