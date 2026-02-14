import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart'; // Used in background handler
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

class NotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  static GoRouter? _router;
  static bool _isSavingToken = false;

  /// Initialize FCM and request permissions
  static Future<void> initialize({GoRouter? router}) async {
    try {
      _router = router;
      
      // Initialize local notifications
      await _initializeLocalNotifications();

      // Request permission for iOS
      NotificationSettings settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        print('User granted notification permission');
      } else if (settings.authorizationStatus == AuthorizationStatus.provisional) {
        print('User granted provisional notification permission');
      } else {
        print('User declined or has not accepted notification permission');
        return;
      }

      // Get FCM token but don't save yet - wait for authentication
      final token = await _messaging.getToken();
      if (token != null) {
        // Only save if user is already authenticated
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          await _saveTokenToFirestore(token);
        }
      }

      // Listen for token refresh
      _messaging.onTokenRefresh.listen((newToken) {
        // Only save if user is authenticated
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          _saveTokenToFirestore(newToken);
        }
      });

      // Listen to auth state changes to save token when user logs in
      // Use a flag to prevent duplicate saves
      FirebaseAuth.instance.authStateChanges().listen((User? user) async {
        if (user != null && !_isSavingToken) {
          _isSavingToken = true;
          // Wait a bit to ensure auth is fully propagated
          await Future.delayed(const Duration(milliseconds: 500));
          try {
            // User logged in, save FCM token
            final token = await _messaging.getToken();
            if (token != null) {
              await _saveTokenToFirestore(token);
            }
          } catch (e) {
            print('Error saving FCM token in auth listener: $e');
          } finally {
            _isSavingToken = false;
          }
        }
      });

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print('Got a message whilst in the foreground!');
        print('Message data: ${message.data}');

        if (message.notification != null) {
          print('Message also contained a notification: ${message.notification}');
          // Show local notification when app is in foreground
          _showLocalNotification(message);
        }
      });

      // Handle background messages (when app is in background)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        print('A new onMessageOpenedApp event was published!');
        print('Message data: ${message.data}');
        // Handle navigation based on notification data
        _handleNotificationNavigation(message);
      });

      // Check if app was opened from a notification
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationNavigation(initialMessage);
      }
    } catch (e) {
      print('Error initializing FCM: $e');
    }
  }

  /// Initialize local notifications plugin
  static Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap
        if (response.payload != null) {
          final data = response.payload!.split('|');
          if (data.length >= 2) {
            final type = data[0];
            final id = data[1];
            _navigateFromNotification(type, id);
          }
        }
      },
    );

    // Create notification channel for Android
    const androidChannel = AndroidNotificationChannel(
      'high_importance_channel',
      'High Importance Notifications',
      description: 'This channel is used for important notifications.',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);
  }

  /// Show local notification for foreground messages
  static Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    final data = message.data;

    if (notification == null) return;

    final androidDetails = AndroidNotificationDetails(
      'high_importance_channel',
      'High Importance Notifications',
      channelDescription: 'This channel is used for important notifications.',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    // Create payload for navigation
    final payload = '${data['type'] ?? 'general'}|${data['id'] ?? ''}';

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      notificationDetails,
      payload: payload,
    );
  }

  /// Save FCM token to Firestore fcmTokens collection
  /// Public method to save token after authentication
  static Future<void> saveTokenAfterAuth() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;
      
      final token = await _messaging.getToken();
      if (token != null) {
        await _saveTokenToFirestore(token);
      }
    } catch (e) {
      print('Error saving FCM token after auth: $e');
    }
  }

  /// Save FCM token to Firestore fcmTokens collection
  static Future<void> _saveTokenToFirestore(String token) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        print('Cannot save FCM token: User not authenticated');
        return;
      }

      // Wait a moment to ensure auth token is ready
      await Future.delayed(const Duration(milliseconds: 300));

      // Save to fcmTokens collection (as per Firestore rules)
      // Use set with merge to avoid read permission issues
      final tokenDoc = _firestore.collection('fcmTokens').doc(user.uid);
      
      // Use set() with merge instead of get() + update/set to avoid permission issues
      // This way we don't need to read first, which requires the document to exist
      // Check if document exists first (but handle permission errors gracefully)
      try {
        final tokenData = await tokenDoc.get();
        if (tokenData.exists) {
          // Update existing token
          await tokenDoc.update({
            'token': token,
            'userId': user.uid,
            'isActive': true,
            'updatedAt': FieldValue.serverTimestamp(),
            'platform': 'mobile',
          });
        } else {
          // Create new token document
          await tokenDoc.set({
            'token': token,
            'userId': user.uid,
            'isActive': true,
            'createdAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
            'platform': 'mobile',
          });
        }
      } catch (readError) {
        // If read fails due to permissions, try to create/update using set with merge
        // This will work if we have create/update permissions even without read
        await tokenDoc.set({
          'token': token,
          'userId': user.uid,
          'isActive': true,
          'updatedAt': FieldValue.serverTimestamp(),
          'platform': 'mobile',
        }, SetOptions(merge: true));
      }

      // Also update user document for backward compatibility (only if we can)
      try {
        await _firestore.collection('users').doc(user.uid).update({
          'fcmToken': token,
          'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
        });
      } catch (e) {
        // Silently fail if user document update fails (might not have permission)
        print('Could not update user document with FCM token: $e');
      }

      print('FCM token saved successfully');
    } catch (e) {
      // Don't print error if it's just a permission issue - user might not be fully authenticated yet
      if (e.toString().contains('permission-denied')) {
        print('FCM token save skipped: User not fully authenticated yet');
      } else {
        print('Error saving FCM token: $e');
      }
    }
  }

  /// Handle navigation when notification is tapped
  static void _handleNotificationNavigation(RemoteMessage message) {
    final data = message.data;
    final type = data['type'] ?? 'general';
    final id = data['id'] ?? data['bookingId'] ?? data['notificationId'] ?? '';
    
    _navigateFromNotification(type, id);
  }

  /// Navigate based on notification type
  static void _navigateFromNotification(String type, String id) {
    if (_router == null) {
      print('Router not initialized. Cannot navigate.');
      return;
    }

    switch (type) {
      case 'booking':
      case 'booking_confirmed':
      case 'booking_cancelled':
        if (id.isNotEmpty) {
          _router!.go('/venue-detail?id=$id');
        }
        break;
      case 'notification':
      case 'general':
        _router!.go('/notifications');
        break;
      case 'match':
      case 'match_result':
        _router!.go('/social-feed');
        break;
      case 'order':
      case 'order_confirmed':
        _router!.go('/marketplace');
        break;
      case 'membership':
        _router!.go('/membership');
        break;
      case 'team':
        _router!.go('/team-up');
        break;
      default:
        _router!.go('/notifications');
    }
  }

  /// Subscribe to topic
  static Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      print('Subscribed to topic: $topic');
    } catch (e) {
      print('Error subscribing to topic: $e');
    }
  }

  /// Unsubscribe from topic
  static Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      print('Unsubscribed from topic: $topic');
    } catch (e) {
      print('Error unsubscribing from topic: $e');
    }
  }

  /// Delete FCM token when user logs out
  static Future<void> deleteToken() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        // Delete from fcmTokens collection
        await _firestore.collection('fcmTokens').doc(user.uid).update({
          'isActive': false,
          'updatedAt': FieldValue.serverTimestamp(),
        });

        // Also remove from user document
        await _firestore.collection('users').doc(user.uid).update({
          'fcmToken': FieldValue.delete(),
        });
      }
      
      await _messaging.deleteToken();
      print('FCM token deleted successfully');
    } catch (e) {
      print('Error deleting FCM token: $e');
    }
  }
}

/// Top-level function for handling background messages
/// Must be a top-level function, not a class method
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Initialize Firebase in background isolate
  await Firebase.initializeApp();
  
  print('Handling a background message: ${message.messageId}');
  print('Message data: ${message.data}');
  
  // You can perform background tasks here
  // Note: This runs in a separate isolate
  // Local notifications can be shown here if needed
}

