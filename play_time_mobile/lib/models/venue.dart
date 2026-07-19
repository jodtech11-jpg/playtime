import '../services/firestore_service.dart';

class Venue {
  final String id;
  final String name;
  final String address;
  final String? location; // For backward compatibility
  final String? distance; // Calculated field
  final double? distanceValue; // Numeric value for sorting
  final double? rating;
  final int? reviews;
  final double? price; // Average price from courts
  final String? image;
  final List<String>? images;
  final List<String> sports;
  final List<String>? tags;
  final List<String>? amenities;
  final double? locationLat;
  final double? locationLng;
  final String? status;
  final List<Map<String, dynamic>>? courts;

  Venue({
    required this.id,
    required this.name,
    required this.address,
    this.location,
    this.distance,
    this.distanceValue,
    this.rating,
    this.reviews,
    this.price,
    this.image,
    this.images,
    required this.sports,
    this.tags,
    this.amenities,
    this.locationLat,
    this.locationLng,
    this.status,
    this.courts,
  });

  factory Venue.fromJson(Map<String, dynamic> json) {
    return Venue(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String? ?? json['location'] as String? ?? '',
      location: json['location'] as String?,
      distance: json['distance'] as String?,
      distanceValue: json['distanceValue'] != null
          ? (json['distanceValue'] as num).toDouble()
          : null,
      rating: json['rating'] != null
          ? (json['rating'] as num).toDouble()
          : null,
      reviews: json['reviews'] as int?,
      price: json['price'] != null ? (json['price'] as num).toDouble() : null,
      image: json['image'] as String? ?? (json['images'] as List?)?.first,
      images: json['images'] != null
          ? List<String>.from(json['images'] as List)
          : null,
      sports: json['sports'] != null
          ? List<String>.from(json['sports'] as List)
          : json['categories'] != null
          ? List<String>.from(json['categories'] as List)
          : [],
      tags: json['tags'] != null
          ? List<String>.from(json['tags'] as List)
          : null,
      amenities: json['amenities'] != null
          ? List<String>.from(json['amenities'] as List)
          : null,
      locationLat: json['location'] != null && json['location'] is Map
          ? (json['location'] as Map)['lat'] as double?
          : null,
      locationLng: json['location'] != null && json['location'] is Map
          ? (json['location'] as Map)['lng'] as double?
          : null,
      status: json['status'] as String?,
      courts: json['courts'] != null
          ? List<Map<String, dynamic>>.from(json['courts'] as List)
          : null,
    );
  }

  factory Venue.fromFirestore(String id, Map<String, dynamic> data) {
    final sanitized = FirestoreService.sanitizeVenueData(data);
    final location = sanitized['location'] as Map<String, dynamic>?;
    final courts = sanitized['courts'] as List<dynamic>?;

    // Calculate average price from courts
    double? avgPrice;
    if (courts != null && courts.isNotEmpty) {
      final prices = courts
          .where((c) => c is Map && c['pricePerHour'] != null)
          .map((c) => (c as Map)['pricePerHour'] as num)
          .toList();
      if (prices.isNotEmpty) {
        avgPrice = prices.reduce((a, b) => a + b) / prices.length;
      }
    }

    return Venue(
      id: id,
      name: sanitized['name'] as String? ?? '',
      address: sanitized['address'] as String? ?? '',
      location: sanitized['address'] as String?,
      distanceValue: sanitized['distanceValue'] != null
          ? (sanitized['distanceValue'] as num).toDouble()
          : null,
      price:
          avgPrice ??
          (sanitized['price'] != null
              ? (sanitized['price'] as num).toDouble()
              : null),
      image:
          sanitized['images'] != null &&
              (sanitized['images'] as List).isNotEmpty
          ? (sanitized['images'] as List).first as String
          : null,
      images: sanitized['images'] != null
          ? List<String>.from(sanitized['images'] as List)
          : null,
      sports: sanitized['sports'] != null
          ? List<String>.from(sanitized['sports'] as List)
          : [],
      tags: sanitized['tags'] != null
          ? List<String>.from(sanitized['tags'] as List)
          : null,
      amenities: sanitized['amenities'] != null
          ? List<String>.from(sanitized['amenities'] as List)
          : null,
      locationLat: location?['lat'] != null
          ? (location!['lat'] as num).toDouble()
          : null,
      locationLng: location?['lng'] != null
          ? (location!['lng'] as num).toDouble()
          : null,
      status: sanitized['status'] as String?,
      courts: courts != null
          ? List<Map<String, dynamic>>.from(
              courts.map((c) => c as Map<String, dynamic>),
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'location': location,
      'distance': distance,
      'distanceValue': distanceValue,
      'rating': rating,
      'reviews': reviews,
      'price': price,
      'image': image,
      'images': images,
      'sports': sports,
      'tags': tags,
      'amenities': amenities,
      'locationLat': locationLat,
      'locationLng': locationLng,
      'status': status,
    };
  }

  /// Avoid reconstructing every field when only [distance] / [distanceValue] change.
  Venue copyWith({
    String? id,
    String? name,
    String? address,
    String? location,
    String? distance,
    double? distanceValue,
    double? rating,
    int? reviews,
    double? price,
    String? image,
    List<String>? images,
    List<String>? sports,
    List<String>? tags,
    List<String>? amenities,
    double? locationLat,
    double? locationLng,
    String? status,
    List<Map<String, dynamic>>? courts,
  }) {
    return Venue(
      id: id ?? this.id,
      name: name ?? this.name,
      address: address ?? this.address,
      location: location ?? this.location,
      distance: distance ?? this.distance,
      distanceValue: distanceValue ?? this.distanceValue,
      rating: rating ?? this.rating,
      reviews: reviews ?? this.reviews,
      price: price ?? this.price,
      image: image ?? this.image,
      images: images ?? this.images,
      sports: sports ?? this.sports,
      tags: tags ?? this.tags,
      amenities: amenities ?? this.amenities,
      locationLat: locationLat ?? this.locationLat,
      locationLng: locationLng ?? this.locationLng,
      status: status ?? this.status,
      courts: courts ?? this.courts,
    );
  }
}
