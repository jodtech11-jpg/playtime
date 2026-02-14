class MembershipPlan {
  final String id;
  final String name;
  final String? venueId;
  final String planType; // 'Monthly' | '6 Months' | 'Annual' (stored as 'type' in Firestore)
  final double price;
  final List<String> features;
  final bool isActive;
  final String? description;

  MembershipPlan({
    required this.id,
    required this.name,
    this.venueId,
    required this.planType,
    required this.price,
    required this.features,
    required this.isActive,
    this.description,
  });

  factory MembershipPlan.fromFirestore(String id, Map<String, dynamic> data) {
    return MembershipPlan(
      id: id,
      name: data['name'] as String? ?? '',
      venueId: data['venueId'] as String?,
      planType: data['planType'] as String? ?? data['type'] as String? ?? 'Monthly',
      price: (data['price'] as num?)?.toDouble() ?? 0.0,
      features: data['features'] != null
          ? List<String>.from(data['features'] as List)
          : [],
      isActive: data['isActive'] as bool? ?? true,
      description: data['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'venueId': venueId,
      'planType': planType,
      'price': price,
      'features': features,
      'isActive': isActive,
      'description': description,
    };
  }
}

