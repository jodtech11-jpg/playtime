/**
 * Console Filter Utility
 * Filters out known harmless console errors/warnings from Firebase and other libraries
 * 
 * This must be initialized as early as possible, before React or other libraries load
 */

/**
 * Initialize console filters to suppress known harmless errors
 * This helps keep the console clean during development
 */
export const initializeConsoleFilters = () => {
  // Only filter in development mode
  if (import.meta.env.DEV) {
    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    /**
     * Check if a message should be filtered out
     */
    const shouldFilter = (args: any[]): boolean => {
      if (!args || args.length === 0) return false;
      
      // Convert all arguments to string for matching
      const fullMessage = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ').toLowerCase();
      
      // Filter out Firebase heartbeat service undefined errors
      if (fullMessage.includes('heartbeats undefined') || 
          (fullMessage.includes('heartbeatservice') && fullMessage.includes('undefined'))) {
        return true;
      }
      
      // Filter React DevTools suggestion (harmless informational message)
      if (fullMessage.includes('download the react devtools') || 
          fullMessage.includes('react.dev/link/react-devtools') ||
          fullMessage.includes('react devtools')) {
        return true;
      }
      
      // Filter browser extension messages (not from our code)
      if (fullMessage.includes('cispl signerdigital') || 
          fullMessage.includes('content.js')) {
        return true;
      }
      
      // Filter service worker registration messages (we handle this separately)
      if (fullMessage.includes('service worker registered successfully')) {
        return true;
      }
      
      return false;
    };

    // Override console.error to filter known harmless errors
    console.error = (...args: any[]) => {
      if (!shouldFilter(args)) {
        originalError.apply(console, args);
      }
    };

    // Override console.warn to filter known harmless warnings
    console.warn = (...args: any[]) => {
      if (!shouldFilter(args)) {
        originalWarn.apply(console, args);
      }
    };

    // Override console.log to filter known harmless logs
    console.log = (...args: any[]) => {
      if (!shouldFilter(args)) {
        originalLog.apply(console, args);
      }
    };
  }
};

