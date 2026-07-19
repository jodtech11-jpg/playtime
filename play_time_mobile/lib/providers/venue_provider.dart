import 'dart:async';

import 'package:flutter/foundation.dart';
import '../models/venue.dart';
import '../services/firestore_service.dart';
import 'package:geolocator/geolocator.dart';
import '../services/notification_service.dart';

class VenueProvider with ChangeNotifier {
  List<Venue> _venues = [];
  bool _isLoading = false;
  String? _error;
  Venue? _selectedVenue;
  int _loadGeneration = 0; // Guards against concurrent loadVenues calls

  List<Venue> get venues => _venues;
  bool get isLoading => _isLoading;
  String? get error => _error;
  Venue? get selectedVenue => _selectedVenue;

  VenueProvider() {
    loadVenues();
  }

  Future<void> loadVenues({double? lat, double? lng}) async {
    final generation = ++_loadGeneration;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final venues = await FirestoreService.getVenues();
      // Discard stale result if a newer load has started
      if (generation != _loadGeneration) return;
      _venues = venues;
      await _calculateDistances(lat: lat, lng: lng, generation: generation);
    } catch (e) {
      if (generation != _loadGeneration) return;
      _error = 'Failed to load venues: $e';
      debugPrint('Error loading venues: $e');
    } finally {
      if (generation == _loadGeneration) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> _calculateDistances({
    double? lat,
    double? lng,
    int? generation,
  }) async {
    try {
      // Get user location for distance calculation
      double targetLat;
      double targetLng;

      if (lat != null && lng != null) {
        targetLat = lat;
        targetLng = lng;
      } else {
        try {
          final Position userPosition = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
            ),
          );
          targetLat = userPosition.latitude;
          targetLng = userPosition.longitude;
        } catch (e) {
          debugPrint('Error getting GPS location for distances: $e');
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

            _venues[i] = venue.copyWith(
              distance: distanceStr,
              distanceValue: distanceKm,
            );
          } catch (e) {
            debugPrint('Error calculating distance for venue ${venue.id}: $e');
          }
        }
      }

      // Sort venues by distance
      _venues.sort((a, b) {
        if (a.distanceValue == null) return 1;
        if (b.distanceValue == null) return -1;
        return a.distanceValue!.compareTo(b.distanceValue!);
      });

      if (generation == null || generation == _loadGeneration) {
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error calculating distances: $e');
    }
  }

  void setSelectedVenue(Venue venue) {
    if (_selectedVenue?.id == venue.id) return;
    _selectedVenue = venue;
    unawaited(NotificationService.syncVenueTopic(venue.id));
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
          // `_calculateDistances` populates `distanceValue` (km). Venues with
          // no location data sink to the bottom.
          filtered.sort((a, b) {
            final da = a.distanceValue;
            final db = b.distanceValue;
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da.compareTo(db);
          });
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
