import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/firestore_service.dart';

class LocationProvider with ChangeNotifier {
  String? _selectedCity;
  String? _selectedState;
  Position? _currentPosition;
  double? _selectedLat;
  double? _selectedLng;
  bool _isLoading = false;
  String? _error;

  String? get selectedCity => _selectedCity;
  String? get selectedState => _selectedState;
  double? get selectedLat => _selectedLat;
  double? get selectedLng => _selectedLng;
  String get displayLocation {
    if (_selectedCity != null && _selectedState != null) {
      return '$_selectedCity, $_selectedState';
    }
    return 'Select Location';
  }
  Position? get currentPosition => _currentPosition;
  bool get isLoading => _isLoading;
  String? get error => _error;

  LocationProvider() {
    _loadUserLocation();
    // Don't request location immediately - wait for explicit request
    // _getCurrentLocation();
  }

  Future<void> _loadUserLocation() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      final userProfile = await FirestoreService.getUserProfile(user.uid);
      if (userProfile != null) {
        _selectedCity = userProfile['city'] as String?;
        _selectedState = userProfile['state'] as String?;
        _selectedLat = userProfile['latitude'] as double?;
        _selectedLng = userProfile['longitude'] as double?;
        notifyListeners();
      }
    } catch (e) {
      print('Error loading user location: $e');
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _error = 'Location services are disabled';
        _isLoading = false;
        notifyListeners();
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          // Don't set error for denied permission - just silently fail
          _error = null;
          _isLoading = false;
          notifyListeners();
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        // Don't set error for permanently denied - just silently fail
        _error = null;
        _isLoading = false;
        notifyListeners();
        return;
      }

      _currentPosition = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      _isLoading = false;
      _error = null;
      notifyListeners();
    } catch (e) {
      // Silently handle permission errors - don't print or show to user
      final errorMessage = e.toString().toLowerCase();
      if (errorMessage.contains('permission') || 
          errorMessage.contains('denied') ||
          errorMessage.contains('location services')) {
        // Permission-related errors - handle silently
        _error = null;
      } else {
        // Other errors - log but don't show to user
        print('Error getting location: $e');
        _error = null;
      }
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Public method to request location (call when needed)
  Future<void> requestLocation() async {
    await _getCurrentLocation();
  }

  Future<void> updateLocation(String city, String state, {double? lat, double? lng}) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      _selectedCity = city;
      _selectedState = state;
      if (lat != null) _selectedLat = lat;
      if (lng != null) _selectedLng = lng;
      notifyListeners();

      await FirestoreService.updateUserProfile(user.uid, {
        'city': city,
        'state': state,
        if (lat != null) 'latitude': lat,
        if (lng != null) 'longitude': lng,
      });
    } catch (e) {
      _error = 'Error updating location: $e';
      notifyListeners();
    }
  }

  Future<void> refreshLocation() async {
    // Only get GPS if we don't have a selection yet
    if (_selectedCity == null) {
      await _getCurrentLocation();
    }
    await _loadUserLocation();
  }
}
