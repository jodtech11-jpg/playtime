import 'package:flutter/foundation.dart';
import '../models/venue.dart';
import '../services/firestore_service.dart';
import 'package:geolocator/geolocator.dart';

class VenueProvider with ChangeNotifier {
  List<Venue> _venues = [];
  bool _isLoading = false;
  String? _error;
  Venue? _selectedVenue;

  List<Venue> get venues => _venues;
  bool get isLoading => _isLoading;
  String? get error => _error;
  Venue? get selectedVenue => _selectedVenue;

  VenueProvider() {
    loadVenues();
  }

  Future<void> loadVenues({double? lat, double? lng}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _venues = await FirestoreService.getVenues();
      // Calculate distances for each venue using specific coordinates if provided
      await _calculateDistances(lat: lat, lng: lng);
    } catch (e) {
      _error = 'Failed to load venues: $e';
      print('Error loading venues: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _calculateDistances({double? lat, double? lng}) async {
    try {
      // Get user location for distance calculation
      double targetLat;
      double targetLng;

      if (lat != null && lng != null) {
        targetLat = lat;
        targetLng = lng;
      } else {
        try {
          Position userPosition = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
            ),
          );
          targetLat = userPosition.latitude;
          targetLng = userPosition.longitude;
        } catch (e) {
          print('Error getting GPS location for distances: $e');
          return;
        }
      }

      // Calculate distances for each venue
      for (int i = 0; i < _venues.length; i++) {
        final venue = _venues[i];
        if (venue.locationLat != null && venue.locationLng != null) {
          try {
            final distance = Geolocator.distanceBetween(
              targetLat,
              targetLng,
              venue.locationLat!,
              venue.locationLng!,
            );

            // Convert to kilometers and format
            final distanceKm = distance / 1000;
            String distanceStr;
            if (distanceKm < 1) {
              distanceStr = '${(distance).round()}m away';
            } else if (distanceKm < 10) {
              distanceStr = '${distanceKm.toStringAsFixed(1)}km away';
            } else {
              distanceStr = '${distanceKm.toStringAsFixed(0)}km away';
            }

            // Update venue with distance (create new venue with distance)
            _venues[i] = Venue(
              id: venue.id,
              name: venue.name,
              address: venue.address,
              location: venue.location,
              distance: distanceStr,
              distanceValue: distanceKm,
              rating: venue.rating,
              reviews: venue.reviews,
              price: venue.price,
              image: venue.image,
              images: venue.images,
              sports: venue.sports,
              tags: venue.tags,
              amenities: venue.amenities,
              locationLat: venue.locationLat,
              locationLng: venue.locationLng,
              status: venue.status,
              courts: venue.courts,
            );
          } catch (e) {
            print('Error calculating distance for venue ${venue.id}: $e');
          }
        }
      }

      // Sort venues by distance
       _venues.sort((a, b) {
        if (a.distanceValue == null) return 1;
        if (b.distanceValue == null) return -1;
        return a.distanceValue!.compareTo(b.distanceValue!);
      });

      notifyListeners();
    } catch (e) {
      print('Error calculating distances: $e');
    }
  }

  void setSelectedVenue(Venue venue) {
    _selectedVenue = venue;
    notifyListeners();
  }

  Future<void> refreshVenues() async {
    await loadVenues();
  }

  List<Venue> getVenuesBySport(String sport) {
    return _venues.where((v) => v.sports.contains(sport)).toList();
  }

  /// Filter venues based on search query, price range, and amenities
  List<Venue> getFilteredVenues({
    String? searchQuery,
    double? maxPrice,
    List<String>? amenities,
    String? sport,
    String? sortBy, // 'price', 'rating', 'distance'
  }) {
    var filtered = List<Venue>.from(_venues);

    // Filter by sport
    if (sport != null && sport.isNotEmpty) {
      filtered = filtered.where((v) => v.sports.contains(sport)).toList();
    }

    // Filter by search query
    if (searchQuery != null && searchQuery.isNotEmpty) {
      final query = searchQuery.toLowerCase();
      filtered = filtered.where((v) {
        return v.name.toLowerCase().contains(query) ||
            v.address.toLowerCase().contains(query) ||
            (v.tags?.any((tag) => tag.toLowerCase().contains(query)) ?? false);
      }).toList();
    }

    // Filter by price
    if (maxPrice != null) {
      filtered = filtered.where((v) {
        final price = v.price ?? 0;
        return price <= maxPrice;
      }).toList();
    }

    // Filter by amenities
    if (amenities != null && amenities.isNotEmpty) {
      filtered = filtered.where((v) {
        if (v.amenities == null || v.amenities!.isEmpty) return false;
        return amenities.every((amenity) => v.amenities!.contains(amenity));
      }).toList();
    }

    // Sort
    if (sortBy != null) {
      switch (sortBy) {
        case 'price':
          filtered.sort((a, b) {
            final priceA = a.price ?? 0;
            final priceB = b.price ?? 0;
            return priceA.compareTo(priceB);
          });
          break;
        case 'price_desc':
          filtered.sort((a, b) {
            final priceA = a.price ?? 0;
            final priceB = b.price ?? 0;
            return priceB.compareTo(priceA); // Descending
          });
          break;
        case 'rating':
          filtered.sort((a, b) {
            final ratingA = a.rating ?? 0;
            final ratingB = b.rating ?? 0;
            return ratingB.compareTo(ratingA); // Descending
          });
          break;
        case 'distance':
          // Distance sorting would require user location
          // For now, keep original order
          break;
      }
    }

    return filtered;
  }

  Stream<List<Venue>> getVenuesStream() {
    return FirestoreService.getVenuesStream();
  }

  Future<void> updateDistances(double lat, double lng) async {
    _isLoading = true;
    notifyListeners();
    await _calculateDistances(lat: lat, lng: lng);
    _isLoading = false;
    notifyListeners();
  }
}

