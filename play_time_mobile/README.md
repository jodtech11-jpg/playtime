# Play Time Mobile App

Flutter mobile application for the Play Time sports booking platform.

## 📱 Features

- **Authentication**: Phone number and Google Sign-In
- **Home Screen**: Browse venues, categories, flash deals, and tournaments
- **Venue Details**: View venue information and book slots
- **Bottom Navigation**: Easy navigation between Home, Team Up, Feed, and Profile
- **Dark Theme**: Modern dark UI matching the web design

## 🏗️ Project Structure

```
lib/
├── main.dart                 # App entry point
├── models/                   # Data models
│   ├── venue.dart
│   ├── booking.dart
│   ├── product.dart
│   └── match_feed_item.dart
├── screens/                  # Screen widgets
│   ├── login_screen.dart
│   ├── home_screen.dart
│   ├── venue_detail_screen.dart
│   ├── profile_screen.dart
│   ├── team_up_screen.dart
│   ├── social_feed_screen.dart
│   ├── marketplace_screen.dart
│   ├── map_view_screen.dart
│   └── notifications_screen.dart
├── widgets/                  # Reusable widgets
│   └── bottom_nav.dart
├── services/                 # Firebase and API services
│   └── firebase_service.dart
├── providers/                # State management
│   └── auth_provider.dart
├── theme/                    # App theme and colors
│   ├── app_colors.dart
│   └── app_theme.dart
└── utils/                    # Utilities and constants
    └── constants.dart
```

## 🚀 Setup Instructions

### Prerequisites

- Flutter SDK (3.10.0 or higher)
- Android Studio / VS Code with Flutter extensions
- Firebase project configured

### Installation

1. **Install dependencies:**
   ```bash
   flutter pub get
   ```

2. **Firebase Configuration:**
   - The `google-services.json` file is already placed in `android/app/`
   - Make sure your Firebase project is configured for Android with package name: `com.playtime.zekto`

3. **Run the app:**
   ```bash
   flutter run
   ```

## 🎨 Design System

The app follows the same design system as the web UI:

- **Primary Color**: `#0DF259` (Green)
- **Background**: Dark theme with `#0A0A0A` and `#121212`
- **Typography**: Bold, modern fonts with proper letter spacing
- **Components**: Rounded corners (16-32px), glassmorphism effects

## 📦 Dependencies

Key packages used:

- `firebase_core` - Firebase initialization
- `firebase_auth` - Authentication
- `cloud_firestore` - Database
- `firebase_storage` - File storage
- `go_router` - Navigation
- `provider` - State management
- `google_sign_in` - Google authentication
- `cached_network_image` - Image caching
- `google_maps_flutter` - Maps integration

## 🔧 Configuration

### Android

- Package name: `com.playtime.zekto`
- Minimum SDK: As per Flutter defaults
- Google Services plugin is configured in `android/app/build.gradle.kts`

### Firebase Setup

1. Ensure `google-services.json` is in `android/app/`
2. Configure Firebase Authentication:
   - Enable Phone Authentication
   - Enable Google Sign-In
3. Configure Firestore database
4. Set up Firebase Storage

## 📝 Next Steps

- [ ] Implement OTP verification screen
- [ ] Connect to Firestore for real data
- [ ] Implement booking functionality
- [ ] Add map view with Google Maps
- [ ] Implement social feed
- [ ] Add marketplace functionality
- [ ] Implement push notifications
- [ ] Add profile management

## 🐛 Known Issues

- Some screens are placeholders and need full implementation
- Phone authentication needs OTP verification screen
- Real-time data fetching from Firestore needs to be implemented

## 📄 License

Proprietary - Play Time Platform
