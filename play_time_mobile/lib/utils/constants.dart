// Constants class - Now using Firestore for all data
// This file is kept for backward compatibility and app-wide constants
class Constants {
  // App-wide constants
  static const String appName = 'Play Time';
  static const String appVersion = '1.0.0';
  
  // Note: All data (venues, products, feed items) is now fetched from Firestore
  // See: FirestoreService and respective providers (VenueProvider, ProductProvider, etc.)
}
