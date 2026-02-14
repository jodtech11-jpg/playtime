import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:geocoding/geocoding.dart';
import 'dart:async';
import '../theme/app_colors.dart';
import '../providers/venue_provider.dart';
import '../providers/location_provider.dart';
import '../models/venue.dart';

// Web-specific: Wait for Google Maps API to be loaded (max 5 seconds)
Future<void> _waitForGoogleMapsApi() async {
  if (!kIsWeb) return;
  
  // Wait up to 5 seconds for Google Maps API to load (polling every 100ms)
  for (int i = 0; i < 50; i++) {
    await Future.delayed(const Duration(milliseconds: 100));
    // The API is loaded when google.maps is defined
    // The simple delay approach combined with async loading in index.html should work
  }
}

class MapViewScreen extends StatefulWidget {
  final bool selectLocation;
  
  const MapViewScreen({super.key, this.selectLocation = false});

  @override
  State<MapViewScreen> createState() => _MapViewScreenState();
}

class _MapViewScreenState extends State<MapViewScreen> {
  GoogleMapController? _mapController;
  Venue? _selectedVenue;
  Set<Marker> _markers = {};
  LatLng? _selectedLocation;
  bool _isSelectingLocation = false;
  bool _isMoving = false;
  bool _markersInitialized = false;
  bool _mapReady = false;
  int _lastVenueCount = 0;
  
  // Cache the Future to prevent recreating it on every build
  late Future<void> _mapLoadingFuture;

  void _createMarkers(List<Venue> venues) {
    if (!mounted) return;
    
    // Deduplicate venues by ID to prevent double markers
    final uniqueVenues = venues.toSet().toList();
    final Map<String, Venue> uniqueVenueMap = {};
    for (var v in venues) {
      uniqueVenueMap[v.id] = v;
    }
    final processedVenues = uniqueVenueMap.values.where((v) {
      // Filter out invalid coordinates (e.g. 0,0 which is likely default/error)
      if (v.locationLat == null || v.locationLng == null) return false;
      if (v.locationLat == 0 && v.locationLng == 0) return false;
      return true;
    }).toList();
    
    // Set first venue as selected if none selected - DO THIS BEFORE CREATING MARKERS
    if (_selectedVenue == null && processedVenues.isNotEmpty) {
      _selectedVenue = processedVenues.first;
    }

    final newMarkers = <Marker>{};
    for (var venue in processedVenues) {
      final isSelected = _selectedVenue?.id == venue.id;
      newMarkers.add(
        Marker(
          markerId: MarkerId(venue.id),
          position: LatLng(
            venue.locationLat!,
            venue.locationLng!,
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            isSelected
                ? BitmapDescriptor.hueRed
                : venue.sports.contains('Cricket')
                    ? BitmapDescriptor.hueYellow
                    : BitmapDescriptor.hueGreen,
          ),
          infoWindow: InfoWindow(
            title: venue.name,
            snippet: '${venue.address} • ₹${(venue.price ?? 0).toInt()}/hr',
          ),
          onTap: () {
            // Update selection and recreate markers in next frame to avoid nested setState
            _selectedVenue = venue;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                _createMarkers(venues); // Re-run with full list, filtering will happen inside
              }
            });
          },
        ),
      );
    }
    
    // Only update if markers have changed to avoid infinite rebuild loops
    bool hasChanged = _markers.length != newMarkers.length;
    if (!hasChanged) {
      final currentIds = _markers.map((m) => m.markerId).toSet();
      final newIds = newMarkers.map((m) => m.markerId).toSet();
      if (!setEquals(currentIds, newIds)) {
        hasChanged = true;
      } else {
        for (final newMarker in newMarkers) {
          final oldMarker = _markers.firstWhere((m) => m.markerId == newMarker.markerId);
          if (oldMarker.position != newMarker.position || 
              oldMarker.icon.toJson().toString() != newMarker.icon.toJson().toString()) {
            hasChanged = true;
            break;
          }
        }
      }
    }
    
    if (hasChanged) {
      setState(() {
        _markers = newMarkers;
      });
    }
  }


  void _fitBounds(List<Venue> venues) {
    if (venues.isEmpty || _mapController == null) return;
    
    final venuesWithLocation = venues.where((v) {
      if (v.locationLat == null || v.locationLng == null) return false;
      // Filter out 0,0 coordinates
      if (v.locationLat == 0 && v.locationLng == 0) return false;
      return true;
    }).toList();

    if (venuesWithLocation.isEmpty) return;
    
    if (venuesWithLocation.length == 1) {
      final venue = venuesWithLocation.first;
      _mapController?.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(venue.locationLat!, venue.locationLng!),
          14,
        ),
      );
      return;
    }
    
    double minLat = venuesWithLocation.first.locationLat!;
    double maxLat = venuesWithLocation.first.locationLat!;
    double minLng = venuesWithLocation.first.locationLng!;
    double maxLng = venuesWithLocation.first.locationLng!;
    
    for (var venue in venuesWithLocation) {
      if (venue.locationLat! < minLat) minLat = venue.locationLat!;
      if (venue.locationLat! > maxLat) maxLat = venue.locationLat!;
      if (venue.locationLng! < minLng) minLng = venue.locationLng!;
      if (venue.locationLng! > maxLng) maxLng = venue.locationLng!;
    }
    
    // Add some padding
    _mapController?.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLat - 0.05, minLng - 0.05),
          northeast: LatLng(maxLat + 0.05, maxLng + 0.05),
        ),
        50, // padding
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _isSelectingLocation = widget.selectLocation;
    // Initialize the Future once in initState to prevent recreating it on every build
    _mapLoadingFuture = _waitForGoogleMapsApi();
  }

  @override
  void dispose() {
    // Don't manually dispose the GoogleMapController - the GoogleMap widget manages its lifecycle
    // On web, disposing before buildView can cause "Maps cannot be retrieved before calling buildView!" error
    _mapController = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final venueProvider = Provider.of<VenueProvider>(context);
    final locationProvider = Provider.of<LocationProvider>(context);
    
    // Only update markers when venues changes
    // We compare a hash/signature of the venues or simply check if we need to update
    if (!_isSelectingLocation && 
        _mapReady && 
        _mapController != null &&
        venueProvider.venues.isNotEmpty) {
        
        // Check if we need to initialize markers or update them
        // We use a simple check or reliance on the provider's notification
        // Note: The diffing logic inside _createMarkers handles unnecessary setStates
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _mapController != null) {
            try {
              // Create markers
              _createMarkers(venueProvider.venues);
              
              // If this was the first load, fit bounds to show all venues
              if (!_markersInitialized) {
                _markersInitialized = true;
                if (venueProvider.venues.length > 1) {
                  _fitBounds(venueProvider.venues);
                } else if (venueProvider.venues.isNotEmpty) {
                  final venue = venueProvider.venues.first;
                  if (venue.locationLat != null && venue.locationLng != null) {
                     _mapController?.animateCamera(
                        CameraUpdate.newLatLngZoom(
                          LatLng(venue.locationLat!, venue.locationLng!),
                          14,
                        ),
                     );
                  }
                }
              }
            } catch (e) {
              debugPrint('Error in post-frame map update: $e');
            }
          }
        });
    }

    // Determine initial camera position
    LatLng initialPosition = const LatLng(13.0827, 80.2707); // Default to Chennai
    
    if (locationProvider.selectedLat != null && locationProvider.selectedLng != null) {
      initialPosition = LatLng(locationProvider.selectedLat!, locationProvider.selectedLng!);
    } else if (locationProvider.currentPosition != null) {
      initialPosition = LatLng(
        locationProvider.currentPosition!.latitude,
        locationProvider.currentPosition!.longitude,
      );
    } else if (venueProvider.venues.isNotEmpty) {
      final firstVenue = venueProvider.venues.firstWhere(
        (v) => v.locationLat != null && v.locationLng != null && (v.locationLat != 0 || v.locationLng != 0),
        orElse: () => venueProvider.venues.first,
      );
      if (firstVenue.locationLat != null && firstVenue.locationLng != null) {
        initialPosition = LatLng(firstVenue.locationLat!, firstVenue.locationLng!);
      }
    }
    
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          if (Navigator.canPop(context)) {
            context.pop();
          } else {
            context.go('/home');
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
      body: Stack(
        children: [
          // Map
          FutureBuilder(
            // Use cached Future to prevent map reload on every build
            future: _mapLoadingFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                  ),
                );
              }
              
              return GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: initialPosition,
                  zoom: 12,
                ),
                markers: _isSelectingLocation ? {} : _markers,
                mapType: MapType.normal,
                myLocationButtonEnabled: false,
                zoomControlsEnabled: false,
                onMapCreated: (GoogleMapController controller) {
                  _mapController = controller;
                  
                  // Apply dark style with error handling
                  try {
                    controller.setMapStyle(_darkMapStyle);
                  } catch (e) {
                    debugPrint('Error setting map style: $e');
                  }
                  
                  // Mark map as ready - this enables the marker update logic in build()
                  if (mounted) {
                    setState(() {
                      _mapReady = true;
                    });
                  }
                  
                  if (_isSelectingLocation) {
                    // Initialize selected location with initial camera position
                    // This is much more reliable than screen coordinate calculations
                    if (mounted) {
                      setState(() {
                        _selectedLocation = initialPosition;
                      });
                    }
                  } else {
                    // Create markers after map is ready and fit bounds
                    final venueProvider = Provider.of<VenueProvider>(context, listen: false);
                    if (venueProvider.venues.isNotEmpty) {
                      _createMarkers(venueProvider.venues);
                      
                      // Fit bounds to show all venues on initial load
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && _mapController != null) {
                          if (venueProvider.venues.length > 1) {
                            _fitBounds(venueProvider.venues);
                          } else {
                            final venue = venueProvider.venues.first;
                            if (venue.locationLat != null && venue.locationLng != null) {
                              _mapController?.animateCamera(
                                CameraUpdate.newLatLngZoom(
                                  LatLng(venue.locationLat!, venue.locationLng!),
                                  14,
                                ),
                              );
                            }
                          }
                        }
                      });
                    }
                  }
                },
                onCameraMoveStarted: () {
                  if (_isSelectingLocation) {
                    setState(() {
                      _isMoving = true;
                    });
                  }
                },
                onCameraMove: (CameraPosition position) {
                  if (_isSelectingLocation) {
                    _selectedLocation = position.target;
                  }
                },
                onCameraIdle: () {
                  if (_isSelectingLocation) {
                    setState(() {
                      _isMoving = false;
                    });
                  }
                },
              );
            },
          ),
          // Header
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark.withOpacity(0.8),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                      child: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                    onPressed: () {
                      if (Navigator.canPop(context)) {
                        context.pop();
                      } else {
                        context.go('/home');
                      }
                    },
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                         final locationProvider = Provider.of<LocationProvider>(context, listen: false);
                         LatLng targetPosition = const LatLng(13.0827, 80.2707);
                         if (locationProvider.selectedLat != null && locationProvider.selectedLng != null) {
                            targetPosition = LatLng(locationProvider.selectedLat!, locationProvider.selectedLng!);
                         } else if (locationProvider.currentPosition != null) {
                            targetPosition = LatLng(
                              locationProvider.currentPosition!.latitude,
                              locationProvider.currentPosition!.longitude,
                            );
                         }
                         if (mounted && _mapController != null) {
                           try {
                             await _mapController?.animateCamera(
                               CameraUpdate.newLatLngZoom(targetPosition, 14),
                             );
                           } catch (e) {
                             debugPrint('Error animating camera: $e');
                           }
                         }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceDark.withOpacity(0.8),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.1),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _isSelectingLocation ? Icons.edit_location : Icons.my_location,
                              color: AppColors.primary,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _isSelectingLocation
                                  ? Text(
                                      _isMoving ? 'Selecting...' : 'Select this location',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    )
                                  : Consumer<LocationProvider>(
                                      builder: (context, locationProvider, child) {
                                        return Text(
                                          locationProvider.displayLocation,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 1,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        );
                                      },
                                    ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark.withOpacity(0.8),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                      child: const Icon(Icons.layers, color: Colors.white),
                    ),
                    onPressed: () {
                      // Toggle map type
                      if (_mapController != null) {
                        _mapController!.setMapStyle(null); // Reset to default
                        // Could add different map styles here
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Map style toggled'),
                            duration: Duration(seconds: 1),
                          ),
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
          // Floating Controls
          Positioned(
            bottom: 200,
            right: 16,
            child: Column(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceDark.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.my_location,
                        color: Colors.white),
                    onPressed: () async {
                      final locationProvider = Provider.of<LocationProvider>(context, listen: false);
                      
                      // Show loading snackbar
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Locating...'),
                          duration: Duration(seconds: 1),
                        ),
                      );

                      await locationProvider.requestLocation();
                      
                      if (locationProvider.currentPosition != null) {
                        if (mounted && _mapController != null) {
                          try {
                            await _mapController?.animateCamera(
                              CameraUpdate.newLatLngZoom(
                                LatLng(
                                  locationProvider.currentPosition!.latitude,
                                  locationProvider.currentPosition!.longitude,
                                ),
                                15,
                              ),
                            );
                          } catch (e) {
                            debugPrint('Error updating map to current position: $e');
                          }
                        }
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Could not get GPS location. Please check permissions.'),
                            backgroundColor: AppColors.error,
                          ),
                        );
                      }
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.add, color: AppColors.backgroundDark),
                    onPressed: () {
                      if (mounted && _mapController != null) {
                        _mapController?.animateCamera(CameraUpdate.zoomIn());
                      }
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceDark.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.remove, color: Colors.white),
                    onPressed: () {
                      if (mounted && _mapController != null) {
                        _mapController?.animateCamera(CameraUpdate.zoomOut());
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
          // Bottom Preview Card (only show when not in location selection mode)
          if (!_isSelectingLocation)
            Consumer<VenueProvider>(
              builder: (context, venueProvider, child) {
                if (_selectedVenue == null || venueProvider.venues.isEmpty) {
                  return const SizedBox.shrink();
                }
              
              return Positioned(
                bottom: 112,
                left: 16,
                right: 16,
                child: GestureDetector(
                  onTap: () {
                    context.push('/venue-detail?id=${_selectedVenue!.id}');
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceDark.withOpacity(0.95),
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.1),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: Image.network(
                                _selectedVenue!.image ?? '',
                                width: 112,
                                height: 112,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    width: 112,
                                    height: 112,
                                    color: AppColors.surfaceDark,
                                    child: const Icon(Icons.image, color: Colors.grey),
                                  );
                                },
                              ),
                            ),
                            Positioned(
                              top: 8,
                              left: 8,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.6),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.1),
                                  ),
                                ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(
                                          Icons.star_rounded,
                                          color: Colors.amber,
                                          size: 12,
                                        ),
                                        const SizedBox(width: 2),
                                        Text(
                                          _selectedVenue!.rating != null ? _selectedVenue!.rating!.toStringAsFixed(1) : 'NEW',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                      ],
                                    ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _selectedVenue!.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.location_on,
                                    color: AppColors.primary,
                                    size: 14,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      '${_selectedVenue!.address}${_selectedVenue!.distance != null ? ' • ${_selectedVenue!.distance}' : ''}',
                                      style: TextStyle(
                                        color: Colors.grey[400],
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'STARTING',
                                        style: TextStyle(
                                          color: Colors.grey[500],
                                          fontSize: 9,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 1,
                                        ),
                                      ),
                                      Text(
                                        '₹${(_selectedVenue!.price ?? 0).toInt()}/hr',
                                        style: const TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ],
                                  ),
                                  ElevatedButton(
                                    onPressed: () {
                                      context.push(
                                          '/venue-detail?id=${_selectedVenue!.id}');
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      foregroundColor: AppColors.backgroundDark,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 20,
                                        vertical: 12,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: const Text(
                                      'BOOK',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
              },
            ),
          // Bottom Button - Location Selection or List View
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: Center(
              child: _isSelectingLocation
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_selectedLocation != null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceDark.withOpacity(0.95),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: AppColors.primary.withOpacity(0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.location_on,
                                  color: AppColors.primary,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Location Selected',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ElevatedButton.icon(
                          onPressed: (_selectedLocation != null && !_isMoving)
                              ? () async {
                                  try {
                                    final locationProvider = Provider.of<LocationProvider>(context, listen: false);
                                    
                                    // Show loading state
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Fetching address...'),
                                        duration: Duration(seconds: 1),
                                      ),
                                    );

                                    // Get address from coordinates
                                    List<Placemark> placemarks;
                                    try {
                                      placemarks = await placemarkFromCoordinates(
                                        _selectedLocation!.latitude,
                                        _selectedLocation!.longitude,
                                      ).timeout(const Duration(seconds: 5));
                                    } catch (e) {
                                      print('Geocoding error: $e');
                                      placemarks = [];
                                    }

                                    String city = 'Unknown';
                                    String state = '';

                                    if (placemarks.isNotEmpty) {
                                      final place = placemarks.first;
                                      city = place.locality ?? place.subAdministrativeArea ?? place.administrativeArea ?? 'Unknown';
                                      state = place.administrativeArea ?? place.country ?? '';
                                    } else {
                                      // Fallback if geocoding fails
                                      city = 'Current Location';
                                      state = '${_selectedLocation!.latitude.toStringAsFixed(2)}, ${_selectedLocation!.longitude.toStringAsFixed(2)}';
                                    }

                                    await locationProvider.updateLocation(
                                      city, 
                                      state,
                                      lat: _selectedLocation!.latitude,
                                      lng: _selectedLocation!.longitude,
                                    );
                                    
                                    if (mounted) {
                                      context.pop();
                                    }
                                  } catch (e) {
                                    if (mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('Error: $e'),
                                          backgroundColor: AppColors.error,
                                        ),
                                      );
                                    }
                                  }
                                }
                              : null,
                          icon: Icon(_isMoving ? Icons.hourglass_empty : Icons.check_circle, size: 18),
                          label: Text(
                            _isMoving ? 'MOVING...' : 'SELECT THIS LOCATION',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.5,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _isMoving ? Colors.grey : AppColors.primary,
                            foregroundColor: _isMoving ? Colors.white : AppColors.backgroundDark,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 32,
                              vertical: 16,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                          ),
                        ),
                      ],
                    )
                  : ElevatedButton.icon(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.list, size: 18),
                      label: const Text(
                        'LIST VIEW',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.5,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.backgroundDark,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 32,
                          vertical: 16,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                      ),
                    ),
            ),
          ),
          // Location Selection Marker
          if (_isSelectingLocation)
            IgnorePointer(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _isMoving ? 'Moving...' : 'Selection Point',
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Icon(
                      Icons.location_on,
                      color: AppColors.primary,
                      size: 48,
                      shadows: [
                        Shadow(
                          color: Colors.black,
                          blurRadius: 10,
                        ),
                      ],
                    ),
                    const SizedBox(height: 48), // Compensate for icon height to keep tip at center
                  ],
                ),
              ),
            ),
        ],
      ),
      ),
    );
  }

  static const String _darkMapStyle = '''
[
  {
    "elementType": "geometry",
    "stylers": [{"color": "#212121"}]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{"visibility": "off"}]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#757575"}]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#212121"}]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{"color": "#757575"}]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#757575"}]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{"color": "#181818"}]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#616161"}]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#1b1b1b"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#2c2c2c"}]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#8a8a8a"}]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{"color": "#373737"}]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{"color": "#3c3c3c"}]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [{"color": "#4e4e4e"}]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#616161"}]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#757575"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{"color": "#000000"}]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#3d3d3d"}]
  }
]
''';
}
