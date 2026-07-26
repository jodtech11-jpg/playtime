import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart'; // Used in background handler
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import '../firebase_options.dart';
import '../utils/app_link_mapper.dart';

class NotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  static GoRouter? _router;
  static bool _isSavingToken = false;
  static bool _initialized = false;
  static String? _venueTopic;
  static final Set<String> _preferenceTopics = {};
  static Map<String, dynamic>? _pendingNavigation;
  static DateTime? _navigationReadyAt;
  static StreamSubscription<String>? _tokenRefreshSubscription;
  static StreamSubscription<User?>? _authSubscription;
  static StreamSubscription<RemoteMessage>? _foregroundSubscription;
  static StreamSubscription<RemoteMessage>? _openedAppSubscription;

  /// Initialize FCM and request permissions
  static Future<void> initialize({GoRouter? router}) async {
    _router = router ?? _router;
    if (_initialized) {
      await _flushPendingNavigation();
      return;
    }

    try {
      // Initialize local notifications
      await _initializeLocalNotifications();

      // Request permission for iOS
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      final permissionGranted =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        debugPrint('User granted notification permission');
      } else if (settings.authorizationStatus ==
          AuthorizationStatus.provisional) {
        debugPrint('User granted provisional notification permission');
      } else {
        debugPrint('User declined or has not accepted notification permission');
      }

      if (permissionGranted) {
        await _tokenRefreshSubscription?.cancel();
        _tokenRefreshSubscription = _messaging.onTokenRefresh.listen((
          newToken,
        ) {
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            unawaited(_saveTokenToFirestore(newToken));
          }
        });
        try {
          // Token retrieval can temporarily fail on iOS before APNs finishes
          // registering. Message handlers must still be installed.
          final token = await _messaging.getToken();
          if (token != null) {
            final user = FirebaseAuth.instance.currentUser;
            if (user != null) {
              await _saveTokenToFirestore(token);
            }
          }
        } catch (error) {
          debugPrint('FCM token is not ready yet: $error');
        }
      }

      // Listen to auth state changes to save token when user logs in
      // Use a flag to prevent duplicate saves
      await _authSubscription?.cancel();
      _authSubscription = FirebaseAuth.instance.authStateChanges().listen((
        User? user,
      ) async {
        if (user != null && !_isSavingToken) {
          _isSavingToken = true;
          // Wait a bit to ensure auth is fully propagated
          await Future.delayed(const Duration(milliseconds: 500));
          try {
            if (permissionGranted) {
              final token = await _messaging.getToken();
              if (token != null) {
                await _saveTokenToFirestore(token);
              }
              final profile = await _firestore
                  .collection('users')
                  .doc(user.uid)
                  .get();
              final preferences =
                  profile.data()?['notificationPreferences'] as Map?;
              final legacy = profile.data()?['notificationSettings'] as Map?;
              await syncPreferenceTopics({
                'booking':
                    preferences?['bookingUpdates'] ??
                    legacy?['booking'] ??
                    true,
                'match':
                    preferences?['matchUpdates'] ?? legacy?['match'] ?? true,
                'social':
                    preferences?['socialUpdates'] ?? legacy?['social'] ?? true,
                'promotional':
                    preferences?['promotions'] ??
                    legacy?['promotional'] ??
                    false,
              });
            }
          } catch (e) {
            debugPrint('Error saving FCM token in auth listener: $e');
          } finally {
            _isSavingToken = false;
            await _flushPendingNavigation();
          }
        }
      });

      // Handle foreground messages
      await _foregroundSubscription?.cancel();
      _foregroundSubscription = FirebaseMessaging.onMessage.listen((
        RemoteMessage message,
      ) {
        debugPrint('Got a message whilst in the foreground!');
        debugPrint('Message data: ${message.data}');

        if (message.notification != null) {
          debugPrint(
            'Message also contained a notification: ${message.notification}',
          );
          // Show local notification when app is in foreground
          unawaited(_showLocalNotification(message));
        }
      });

      // Handle background messages (when app is in background)
      await _openedAppSubscription?.cancel();
      _openedAppSubscription = FirebaseMessaging.onMessageOpenedApp.listen((
        RemoteMessage message,
      ) {
        debugPrint('A new onMessageOpenedApp event was published!');
        debugPrint('Message data: ${message.data}');
        // Handle navigation based on notification data
        unawaited(_handleNotificationNavigation(message));
      });

      // Check if app was opened from a notification
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        // Splash performs its own delayed redirect. Queue cold-start
        // navigation until that redirect has completed so it is not overwritten.
        _pendingNavigation = Map<String, dynamic>.from(initialMessage.data);
        _navigationReadyAt = DateTime.now().add(
          const Duration(milliseconds: 2500),
        );
        unawaited(
          Future<void>.delayed(
            const Duration(milliseconds: 2500),
            _flushPendingNavigation,
          ),
        );
      }
      _initialized = true;
    } catch (e) {
      _initialized = false;
      debugPrint('Error initializing FCM: $e');
    }
  }

  /// Initialize local notifications plugin
  static Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
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
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final decoded = jsonDecode(payload);
          if (decoded is Map) {
            unawaited(
              _handleNotificationData(
                decoded.map((key, value) => MapEntry('$key', '$value')),
              ),
            );
            return;
          }
        } catch (_) {
          // Fall through for notifications created by older app versions.
        }
        final legacy = payload.split('|');
        if (legacy.length >= 2) {
          unawaited(
            _handleNotificationData({'type': legacy[0], 'id': legacy[1]}),
          );
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
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(androidChannel);
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
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
    final payload = jsonEncode(data);

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
      debugPrint('Error saving FCM token after auth: $e');
    }
  }

  /// Save FCM token to Firestore fcmTokens collection
  static String _tokenDocumentId(String userId, String token) {
    final encoded = base64Url.encode(utf8.encode(token)).replaceAll('=', '');
    return '${userId}_$encoded';
  }

  static Future<void> _saveTokenToFirestore(String token) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        debugPrint('Cannot save FCM token: User not authenticated');
        return;
      }

      // Wait a moment to ensure auth token is ready
      await Future.delayed(const Duration(milliseconds: 300));

      // One document per device token. Using user.uid as the document ID caused
      // each new phone/browser login to overwrite the previous device.
      final tokenDoc = _firestore
          .collection('fcmTokens')
          .doc(_tokenDocumentId(user.uid, token));
      await tokenDoc.set({
        'token': token,
        'userId': user.uid,
        'isActive': true,
        'deviceType': 'mobile',
        'platform': defaultTargetPlatform.name,
        'lastUsedAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      // Also update user document for backward compatibility (only if we can)
      try {
        await _firestore.collection('users').doc(user.uid).update({
          'fcmToken': token,
          'fcmTokenUpdatedAt': FieldValue.serverTimestamp(),
        });
      } catch (e) {
        // Silently fail if user document update fails (might not have permission)
        debugPrint('Could not update user document with FCM token: $e');
      }

      debugPrint('FCM token saved successfully');
    } catch (e) {
      // Don't print error if it's just a permission issue - user might not be fully authenticated yet
      if (e.toString().contains('permission-denied')) {
        debugPrint('FCM token save skipped: User not fully authenticated yet');
      } else {
        debugPrint('Error saving FCM token: $e');
      }
    }
  }

  /// Handle navigation when notification is tapped
  static Future<void> _handleNotificationNavigation(
    RemoteMessage message,
  ) async {
    await _handleNotificationData(message.data);
  }

  static Future<void> _handleNotificationData(Map<String, dynamic> data) async {
    if (_router == null || FirebaseAuth.instance.currentUser == null) {
      _pendingNavigation = Map<String, dynamic>.from(data);
      debugPrint('Notification navigation queued until app authentication.');
      return;
    }

    final notificationId = data['notificationId']?.toString();
    if (notificationId?.isNotEmpty == true) {
      try {
        await _firestore
            .collection('notifications')
            .doc(notificationId)
            .update({
              'read': true,
              'isRead': true,
              'readAt': FieldValue.serverTimestamp(),
              'updatedAt': FieldValue.serverTimestamp(),
            });
      } catch (error) {
        debugPrint('Could not mark opened notification as read: $error');
      }
    }

    final actionUrl = data['actionUrl']?.toString().trim() ?? '';
    if (actionUrl.startsWith('/') && !actionUrl.startsWith('//')) {
      _router!.go(actionUrl);
      return;
    }
    final actionUri = Uri.tryParse(actionUrl);
    final mappedAction = actionUri == null
        ? null
        : AppLinkMapper.routeFor(actionUri);
    if (mappedAction != null) {
      _router!.go(mappedAction);
      return;
    }

    final type = (data['type']?.toString() ?? 'general').toLowerCase();
    switch (type) {
      case 'booking':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_completed':
        final bookingId =
            data['bookingId']?.toString() ?? data['id']?.toString() ?? '';
        _router!.go(
          bookingId.isNotEmpty
              ? '/booking/${Uri.encodeComponent(bookingId)}'
              : '/bookings',
        );
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
      case 'order_shipped':
      case 'order_delivered':
      case 'checkout_success':
        final orderId =
            data['orderId']?.toString() ?? data['id']?.toString() ?? '';
        _router!.go(
          orderId.isEmpty
              ? '/orders'
              : '/order/${Uri.encodeComponent(orderId)}',
        );
        break;
      case 'membership':
        _router!.go('/membership');
        break;
      case 'team':
        _router!.go('/team-up');
        break;
      case 'tournament':
      case 'quick_match':
      case 'match_invite':
        _router!.go('/team-up');
        break;
      case 'poll':
      case 'flash_deal':
      case 'campaign':
      case 'marketing':
      case 'announcement':
      case 'promotion':
      case 'offer':
        _router!.go('/home');
        break;
      default:
        _router!.go('/notifications');
    }
  }

  static Future<void> _flushPendingNavigation() async {
    final pending = _pendingNavigation;
    if (pending == null ||
        _router == null ||
        FirebaseAuth.instance.currentUser == null) {
      return;
    }
    final readyAt = _navigationReadyAt;
    if (readyAt != null && DateTime.now().isBefore(readyAt)) {
      return;
    }
    _pendingNavigation = null;
    _navigationReadyAt = null;
    await _handleNotificationData(pending);
  }

  /// Subscribe to topic
  static Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      debugPrint('Subscribed to topic: $topic');
    } catch (e) {
      debugPrint('Error subscribing to topic: $e');
    }
  }

  /// Unsubscribe from topic
  static Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      debugPrint('Unsubscribed from topic: $topic');
    } catch (e) {
      debugPrint('Error unsubscribing from topic: $e');
    }
  }

  static Future<void> syncVenueTopic(String? venueId) async {
    final next = venueId?.isNotEmpty == true
        ? 'venue_${venueId!.replaceAll(RegExp(r'[^a-zA-Z0-9\-_.~%]'), '_')}'
        : null;
    if (next == _venueTopic) return;
    final previous = _venueTopic;
    _venueTopic = next;
    if (previous != null) await unsubscribeFromTopic(previous);
    if (next != null) await subscribeToTopic(next);
  }

  static Future<void> syncPreferenceTopics(
    Map<String, dynamic> preferences,
  ) async {
    const topicsByPreference = {
      'booking': 'booking_updates',
      'match': 'match_updates',
      'social': 'social_updates',
      'promotional': 'promotions',
    };
    for (final entry in topicsByPreference.entries) {
      final enabled = preferences[entry.key] == true;
      if (enabled && !_preferenceTopics.contains(entry.value)) {
        await subscribeToTopic(entry.value);
        _preferenceTopics.add(entry.value);
      } else if (!enabled && _preferenceTopics.contains(entry.value)) {
        await unsubscribeFromTopic(entry.value);
        _preferenceTopics.remove(entry.value);
      }
    }
  }

  /// Delete FCM token when user logs out
  static Future<void> deleteToken() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final token = await _messaging.getToken();
        if (token != null) {
          final matchingTokens = await _firestore
              .collection('fcmTokens')
              .where('userId', isEqualTo: user.uid)
              .where('token', isEqualTo: token)
              .get();
          final batch = _firestore.batch();
          for (final document in matchingTokens.docs) {
            batch.update(document.reference, {
              'isActive': false,
              'updatedAt': FieldValue.serverTimestamp(),
            });
          }
          if (matchingTokens.docs.isNotEmpty) {
            await batch.commit();
          }
        }

        // Also remove from user document
        await _firestore.collection('users').doc(user.uid).update({
          'fcmToken': FieldValue.delete(),
        });
      }

      await _messaging.deleteToken();
      debugPrint('FCM token deleted successfully');
    } catch (e) {
      debugPrint('Error deleting FCM token: $e');
    }
  }
}

/// Top-level function for handling background messages
/// Must be a top-level function, not a class method
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Initialize Firebase in background isolate
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  debugPrint('Handling a background message: ${message.messageId}');
  debugPrint('Message data: ${message.data}');

  // You can perform background tasks here
  // Note: This runs in a separate isolate
  // Local notifications can be shown here if needed
}
