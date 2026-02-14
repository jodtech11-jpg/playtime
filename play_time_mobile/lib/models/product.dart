class Product {
  final String id;
  final String name;
  final String brand;
  final double price;
  final double originalPrice;
  final String image;
  final String? tag;
  final String? category;

  Product({
    required this.id,
    required this.name,
    required this.brand,
    required this.price,
    required this.originalPrice,
    required this.image,
    this.tag,
    this.category,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String? ?? '',
      price: (json['price'] as num).toDouble(),
      originalPrice: (json['originalPrice'] as num?)?.toDouble() ?? (json['price'] as num).toDouble(),
      image: json['image'] as String? ?? (json['images'] as List?)?.first ?? '',
      tag: json['tag'] as String?,
      category: json['category'] as String?,
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
    };
  }

  double get discountPercentage {
    if (originalPrice > price) {
      return ((originalPrice - price) / originalPrice * 100).roundToDouble();
    }
    return 0;
  }
}

