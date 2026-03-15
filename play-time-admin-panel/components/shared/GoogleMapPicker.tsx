import React, { useEffect, useRef, useState } from 'react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

interface GoogleMapPickerProps {
  address: string;
  lat: number;
  lng: number;
  onAddressChange: (address: string) => void;
  onLocationChange: (lat: number, lng: number) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  address,
  lat,
  lng,
  onAddressChange,
  onLocationChange
}) => {
  const addressInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const { isLoaded: mapLoaded, loadError } = useGoogleMaps();

  // Initialize Autocomplete (keeping Autocomplete for compatibility, but can be migrated later)
  useEffect(() => {
    if (!mapLoaded || !addressInputRef.current) return;

    // Helper function to initialize Autocomplete
    const initializeAutocomplete = () => {
      if (!addressInputRef.current || !window.google?.maps?.places?.Autocomplete) return;

      // Use Autocomplete for now (still supported for existing customers)
      // Can be migrated to PlaceAutocompleteElement when needed
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'in' } // Restrict to India
        }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) {
          const location = place.geometry.location;
          const newLat = typeof location.lat === 'function' ? location.lat() : location.lat;
          const newLng = typeof location.lng === 'function' ? location.lng() : location.lng;
          const newAddress = place.formatted_address || place.name || address;

          onAddressChange(newAddress);
          onLocationChange(newLat, newLng);

          // Update map center and marker
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: newLat, lng: newLng });
            updateMarker(newLat, newLng);
          }
        }
      });
    };

    // Check if places library is available
    if (!window.google?.maps?.places?.Autocomplete) {
      // Wait a bit for places library to load
      const checkPlaces = setInterval(() => {
        if (window.google?.maps?.places?.Autocomplete) {
          clearInterval(checkPlaces);
          // Retry initialization
          if (!autocompleteRef.current && addressInputRef.current) {
            initializeAutocomplete();
          }
        }
      }, 100);

      return () => clearInterval(checkPlaces);
    }

    if (!autocompleteRef.current) {
      initializeAutocomplete();
    }
  }, [mapLoaded, address, onAddressChange, onLocationChange]);

  // Helper function to update or create marker using AdvancedMarkerElement
  const updateMarker = (newLat: number, newLng: number) => {
    if (!mapInstanceRef.current || !window.google?.maps?.marker) return;

    if (markerRef.current) {
      markerRef.current.position = { lat: newLat, lng: newLng };
    } else {
      // Use AdvancedMarkerElement instead of deprecated Marker
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position: { lat: newLat, lng: newLng },
        gmpDraggable: true
      });

      // Listen for drag end
      markerRef.current.addListener('dragend', () => {
        const position = markerRef.current.position;
        const dragLat = typeof position.lat === 'function' ? position.lat() : position.lat;
        const dragLng = typeof position.lng === 'function' ? position.lng() : position.lng;
        onLocationChange(dragLat, dragLng);

        // Reverse geocode to get address
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: dragLat, lng: dragLng } }, (results: any[], status: string) => {
          if (status === 'OK' && results[0]) {
            onAddressChange(results[0].formatted_address);
          }
        });
      });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    // Helper function to initialize map
    const initializeMap = () => {
      // Check if Map constructor is available
      if (!window.google?.maps?.Map) {
        return false;
      }

      if (!mapInstanceRef.current && mapRef.current) {
        const initialLat = lat !== 0 ? lat : 9.9252; // Default to Madurai, Tamil Nadu
        const initialLng = lng !== 0 ? lng : 78.1198;

        try {
          mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: initialLat, lng: initialLng },
            zoom: lat !== 0 && lng !== 0 ? 15 : 12,
            mapId: 'PLAYTIME_MAP_ID', // Required for AdvancedMarkerElement
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
          });

          // Add click listener to map
          mapInstanceRef.current.addListener('click', (e: any) => {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            onLocationChange(newLat, newLng);

            // Reverse geocode to get address
            if (window.google?.maps?.Geocoder) {
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any[], status: string) => {
                if (status === 'OK' && results[0]) {
                  onAddressChange(results[0].formatted_address);
                }
              });
            }

            // Update or create marker
            updateMarker(newLat, newLng);
          });

          return true;
        } catch (error) {
          console.error('Error initializing Google Map:', error);
          return false;
        }
      }
      return true;
    };

    // Check if Map is available, if not wait for it
    if (!window.google?.maps?.Map) {
      const checkMap = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(checkMap);
          initializeMap();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkMap);
        if (!window.google?.maps?.Map) {
          console.error('Google Maps Map constructor not available after timeout');
        }
      }, 5000);

      return () => clearInterval(checkMap);
    }

    // If Map is available, initialize
    if (!mapInstanceRef.current) {
      initializeMap();
    }

    // Update map center and marker if lat/lng changed externally
    if (lat !== 0 && lng !== 0 && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
      updateMarker(lat, lng);
    }
  }, [mapLoaded, lat, lng, onAddressChange, onLocationChange]);

  return (
    <div className="space-y-4">
      {/* Address Input with Autocomplete */}
      <div>
        <label className="block text-sm font-black text-gray-700 mb-2">Address *</label>
        <div className="relative">
          <input
            ref={addressInputRef}
            type="text"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Search for an address or click on the map"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary pr-10"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <span className="material-symbols-outlined">search</span>
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Start typing to search or click on the map to set location</p>
      </div>

      {/* Map */}
      {loadError ? (
        <div className="w-full h-64 rounded-xl border border-red-200 bg-red-50 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-sm text-red-600 font-medium mb-2">Failed to load Google Maps</p>
            <p className="text-xs text-red-500">{loadError}</p>
          </div>
        </div>
      ) : mapLoaded ? (
        <div>
          <label className="block text-sm font-black text-gray-700 mb-2">Location Map</label>
          <div
            ref={mapRef}
            className="w-full h-64 rounded-xl border border-gray-200 overflow-hidden"
            style={{ minHeight: '256px' }}
          />
          <p className="text-xs text-gray-500 mt-1">Click on the map or drag the marker to set the exact location</p>
        </div>
      ) : (
        <div className="w-full h-64 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}

      {/* Coordinates Display */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-black text-gray-700 mb-2">Latitude</label>
          <input
            type="number"
            step="any"
            value={lat.toFixed(6)}
            onChange={(e) => {
              const newLat = parseFloat(e.target.value) || 0;
              onLocationChange(newLat, lng);
              if (mapInstanceRef.current && newLat !== 0) {
                mapInstanceRef.current.setCenter({ lat: newLat, lng });
                updateMarker(newLat, lng);
              }
            }}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-black text-gray-700 mb-2">Longitude</label>
          <input
            type="number"
            step="any"
            value={lng.toFixed(6)}
            onChange={(e) => {
              const newLng = parseFloat(e.target.value) || 0;
              onLocationChange(lat, newLng);
              if (mapInstanceRef.current && newLng !== 0) {
                mapInstanceRef.current.setCenter({ lat, lng: newLng });
                updateMarker(lat, newLng);
              }
            }}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
            readOnly
          />
        </div>
      </div>
    </div>
  );
};

export default GoogleMapPicker;
