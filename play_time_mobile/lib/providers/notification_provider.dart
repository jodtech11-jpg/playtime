import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
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
    _notificationsSubscription =
        FirestoreService.getUserNotificationsStream(userId).listen(
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
      final unread = _notifications.where((n) => n['read'] != true).toList();
      if (unread.isEmpty) return;

      // Batch update instead of N+1 individual writes
      final batch = FirebaseFirestore.instance.batch();
      for (final notification in unread) {
        final id = notification['id'] as String?;
        if (id == null) continue;
        final ref = FirebaseFirestore.instance
            .collection('notifications')
            .doc(id);
        batch.update(ref, {
          'read': true,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
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
    final today = DateTime.now();
    return _notifications.where((n) {
      final createdAt = n['createdAt'];
      if (createdAt == null) return false;
      DateTime? date;
      if (createdAt is Timestamp) {
        date = createdAt.toDate();
      } else if (createdAt is DateTime) {
        date = createdAt;
      }
      if (date == null) return false;
      return date.year == today.year &&
          date.month == today.month &&
          date.day == today.day;
    }).toList();
  }

  @override
  void dispose() {
    _notificationsSubscription?.cancel();
    super.dispose();
  }
}
