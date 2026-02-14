class Sport {
  final String id;
  final String name;
  final String? description;
  final String? icon;
  final String? color;
  final bool isActive;
  final int? order;
  final String? imageUrl;

  Sport({
    required this.id,
    required this.name,
    this.description,
    this.icon,
    this.color,
    required this.isActive,
    this.order,
    this.imageUrl,
  });

  factory Sport.fromFirestore(Map<String, dynamic> data, String id) {
    return Sport(
      id: id,
      name: data['name'] ?? '',
      description: data['description'],
      icon: data['icon'],
      color: data['color'],
      isActive: data['isActive'] ?? true,
      order: data['order'],
      imageUrl: data['imageUrl'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'name': name,
      'description': description,
      'icon': icon,
      'color': color,
      'isActive': isActive,
      'order': order,
      'imageUrl': imageUrl,
    };
  }
}

