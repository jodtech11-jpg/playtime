# Supabase OAuth Setup for Flutter (Android)

## 1. Add Dependency

Add `supabase_flutter` to your `pubspec.yaml`:

```bash
flutter pub add supabase_flutter
```

## 2. Platform Configuration (Android)

✅ **Completed**: `AndroidManifest.xml` has been updated with:
- `launchMode="singleTask"`
- Intent Filter for `playtime://login-callback`

## 3. Initialization (`lib/main.dart`)

Initialize Supabase in your `main()` function:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  );
  
  runApp(const MyApp());
}
```

## 4. Perform OAuth Sign-In

Use the `signInWithOAuth` method. The `redirectTo` must match the scheme/host defined in `AndroidManifest.xml`.

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> signInWithGoogle() async {
  try {
    await Supabase.instance.client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: 'playtime://login-callback',
    );
  } catch (e) {
    print('Error signing in: $e');
  }
}
```

## 5. Google Cloud Console Setup

Ensure you have added the **Supabase Callback URL** to your Google Cloud Console Credentials (Authorized Redirect URIs):

```
https://<YOUR_PROJECT_ID>.supabase.co/auth/v1/callback
```

## 6. Important Notes

- Since you are currently using `firebase_auth`, you will need to plan your migration or coexistence strategy.
- Ensure your Supabase project > Authentication > URL Configuration > **Redirect URLs** includes `playtime://login-callback`.
