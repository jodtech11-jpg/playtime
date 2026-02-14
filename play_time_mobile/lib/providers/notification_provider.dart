import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/firestore_service.dart';

class NotificationProvider with ChangeNotifier {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription<List<Map<String, dynamic>>>? _notificationsSubscription;

  List<Map<String, dynamic>> get notifications => _notifications;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  int get unreadCount => _notifications.where((n) => n['read'] != true).length;

  NotificationProvider() {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadNotifications(user.uid);
    }
    
    // Listen to auth state changes
    FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        _loadNotifications(user.uid);
      } else {
        _notifications = [];
        notifyListeners();
      }
    });
  }

  void _loadNotifications(String userId) {
    _isLoading = true;
    _error = null;
    notifyListeners();

    _notificationsSubscription?.cancel();
    _notificationsSubscription = FirestoreService.getUserNotificationsStream(userId).listen(
      (notifications) {
        _notifications = notifications;
        _isLoading = false;
        notifyListeners();
      },
      onError: (error) {
        _error = 'Failed to load notifications: $error';
        _isLoading = false;
        notifyListeners();
      },
    );
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      await FirestoreService.markNotificationAsRead(notificationId);
      await refreshNotifications();
    } catch (e) {
      _error = 'Failed to mark notification as read: $e';
      notifyListeners();
    }
  }

  Future<void> markAllAsRead() async {
    try {
      for (final notification in _notifications) {
        if (notification['read'] != true) {
          await FirestoreService.markNotificationAsRead(notification['id'] as String);
        }
      }
      await refreshNotifications();
    } catch (e) {
      _error = 'Failed to mark all as read: $e';
      notifyListeners();
    }
  }

  Future<void> refreshNotifications() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _loadNotifications(user.uid);
    }
  }

  List<Map<String, dynamic>> getTodayNotifications() {
    return _notifications.where((n) {
      final createdAt = n['createdAt'];
      if (createdAt == null) return false;
      // Check if notification is from today
      return true; // Simplified - can be enhanced with date comparison
    }).toList();
  }

  @override
  void dispose() {
    _notificationsSubscription?.cancel();
    super.dispose();
  }
}

