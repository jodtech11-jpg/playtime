import React, { useEffect, useRef } from 'react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

interface GoogleMapDisplayProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({
  lat,
  lng,
  label = 'Venue location',
  className = 'h-72',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const { isLoaded, loadError } = useGoogleMaps();

  useEffect(() => {
    if (!isLoaded || !containerRef.current || !window.google?.maps?.Map) return;

    const position = { lat, lng };
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center: position,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
      });
    } else {
      mapRef.current.setCenter(position);
    }

    // Classic Marker avoids requiring a Cloud Console Map ID (AdvancedMarker).
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: label,
      });
    } else {
      markerRef.current.setPosition(position);
      markerRef.current.setTitle(label);
    }
  }, [isLoaded, lat, lng, label]);

  if (loadError) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-xs text-slate-500`}>
        Map unavailable
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} animate-pulse bg-slate-100 dark:bg-slate-800`} aria-label="Loading map" />
    );
  }

  return <div ref={containerRef} className={className} aria-label={label} />;
};

export default GoogleMapDisplay;
