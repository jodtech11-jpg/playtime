class MembershipPlan {
  final String id;
  final String name;
  final String? venueId;

  /// `platform` = Play Time Pro (player); `venue` = vendor subscription.
  final String? scope;
  final String
  planType; // 'Monthly' | '6 Months' | 'Annual' (stored as 'type' in Firestore)
  final double price;
  final List<String> features;
  final bool isActive;
  final String? description;

  MembershipPlan({
    required this.id,
    required this.name,
    this.venueId,
    this.scope,
    required this.planType,
    required this.price,
    required this.features,
    required this.isActive,
    this.description,
  });

  /// Player / Play Time Pro plans (not tied to a vendor venue).
  bool get isPlatformPlan {
    final s = (scope ?? '').toLowerCase().trim();
    if (s == 'platform' || s == 'player') return true;
    final v = (venueId ?? '').trim();
    return v.isEmpty || v == 'platform';
  }

  /// Vendor venue subscription plans (formerly called venue memberships).
  bool get isVenueSubscription {
    final s = (scope ?? '').toLowerCase().trim();
    if (s == 'platform' || s == 'player') return false;
    final v = (venueId ?? '').trim();
    return v.isNotEmpty && v != 'platform';
  }

  factory MembershipPlan.fromFirestore(String id, Map<String, dynamic> data) {
    return MembershipPlan(
      id: id,
      name: data['name'] as String? ?? '',
      venueId: data['venueId'] as String?,
      scope: data['scope'] as String?,
      planType:
          data['planType'] as String? ?? data['type'] as String? ?? 'Monthly',
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
      'scope': scope,
      'planType': planType,
      'price': price,
      'features': features,
      'isActive': isActive,
      'description': description,
    };
  }
}
