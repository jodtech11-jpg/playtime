/**
 * Console Filter Utility
 * Filters out known harmless console errors/warnings from Firebase and other libraries
 *
 * This must be initialized as early as possible, before React or other libraries load
 */

const FILTER_PATTERNS = [
  'heartbeats undefined',
  'heartbeatservice',
  'heartbeats',
  'download the react devtools',
  'react.dev/link/react-devtools',
  'react devtools',
  'react-devtools',
  'react devtools for a better',
  'cispl signerdigital',
  'cispl',
  'signerdigital',
  'content.js',
  'service worker registered successfully',
  'react-dom_client.js',
  'better development experience',
  'devtools extension',
  'download the react',
  'notifications permission has been blocked',
];

export const shouldFilterConsoleMessage = (args: unknown[]): boolean => {
  if (!args || args.length === 0) return false;

  const firstArg = args[0];
  if (typeof firstArg === 'string') {
    const first = firstArg.toLowerCase();
    if (
      first === 'heartbeats' ||
      first.includes('react devtools') ||
      first.includes('react-devtools') ||
      first.includes('cispl') ||
      first.includes('signerdigital') ||
      first.includes('content.js') ||
      first.includes('better development experience') ||
      first.includes('download the react')
    ) {
      return true;
    }
  }

  const fullMessage = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ')
    .toLowerCase();

  return FILTER_PATTERNS.some((pattern) => fullMessage.includes(pattern));
};

/**
 * Initialize console filters to suppress known harmless errors
 * This helps keep the console clean during development
 */
export const initializeConsoleFilters = () => {
  if (!import.meta.env.DEV) {
    return;
  }

  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  const wrap =
    (original: (...data: unknown[]) => void) =>
    (...args: unknown[]) => {
      if (!shouldFilterConsoleMessage(args)) {
        original.apply(console, args);
      }
    };

  console.error = wrap(originalError);
  console.warn = wrap(originalWarn);
  console.log = wrap(originalLog);
  console.info = wrap(originalInfo);
  console.debug = wrap(originalDebug);
};
