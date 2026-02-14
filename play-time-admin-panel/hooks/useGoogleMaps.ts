import { useEffect, useState } from 'react';

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already loaded (including places library)
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[data-google-maps]');
    if (existingScript) {
      // Wait for existing script to load
      existingScript.addEventListener('load', () => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
        }
      });
      return;
    }

    // Get API key from environment variable
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    
    if (!apiKey) {
      setLoadError('Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.');
      console.error('VITE_GOOGLE_MAPS_API_KEY is not set in environment variables');
      return;
    }

    // Create callback function
    window.initGoogleMaps = () => {
      // Wait for maps API and places library to be available
      const checkMaps = setInterval(() => {
        if (window.google && 
            window.google.maps && 
            window.google.maps.Map && // Ensure Map constructor is available
            window.google.maps.places) {
          clearInterval(checkMaps);
          setIsLoaded(true);
        }
      }, 50);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkMaps);
        if (window.google && window.google.maps && window.google.maps.Map) {
          // Even if places isn't loaded, set loaded to true if Map is available
          // Places might load later
          setIsLoaded(true);
        } else {
          setLoadError('Google Maps API failed to load properly. Map constructor not available.');
        }
      }, 5000);
    };

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&callback=initGoogleMaps&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps', 'true');
    
    script.onerror = () => {
      setLoadError('Failed to load Google Maps script.');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts (optional)
      // Note: Usually we want to keep it loaded for other components
    };
  }, []);

  return { isLoaded, loadError };
};

