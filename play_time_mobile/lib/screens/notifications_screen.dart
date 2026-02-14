import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../theme/app_colors.dart';
import '../providers/notification_provider.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<NotificationProvider>(
      builder: (context, notificationProvider, child) {
        if (notificationProvider.isLoading) {
          return Scaffold(
            backgroundColor: AppColors.backgroundDark,
            body: const LoadingWidget(message: 'Loading notifications...'),
          );
        }
        
        if (notificationProvider.error != null) {
          return Scaffold(
            backgroundColor: AppColors.backgroundDark,
            body: ErrorDisplayWidget(
              message: notificationProvider.error!,
              onRetry: () {
                // Reload notifications by refreshing the provider
                notificationProvider.refreshNotifications();
              },
            ),
          );
        }
        
        final notifications = notificationProvider.notifications;
        final todayNotifications = notificationProvider.getTodayNotifications();
        final earlierNotifications = notifications.where((n) => 
          !todayNotifications.contains(n)
        ).toList();

        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, result) {
            if (!didPop) {
              if (Navigator.canPop(context)) {
                context.pop();
              } else {
                context.go('/home');
              }
            }
          },
          child: Scaffold(
            backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.backgroundDark.withOpacity(0.95),
                border: Border(
                  bottom: BorderSide(color: Colors.white.withOpacity(0.05)),
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                      child: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                    onPressed: () {
                      if (Navigator.canPop(context)) {
                        context.pop();
                      } else {
                        context.go('/home');
                      }
                    },
                  ),
                  const Expanded(
                    child: Text(
                      'Notifications',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      notificationProvider.markAllAsRead();
                    },
                    child: const Text(
                      'MARK ALL READ',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Content
            Expanded(
              child: notifications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.notifications_off,
                            size: 64,
                            color: Colors.grey[600],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Nothing here yet',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'We\'ll alert you when there\'s news',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Today Section
                          if (todayNotifications.isNotEmpty) ...[
                            Text(
                              'TODAY',
                              style: TextStyle(
                                color: Colors.grey[500],
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.5,
                              ),
                            ),
                            const SizedBox(height: 16),
                            ...todayNotifications.map((notif) =>
                                _buildNotificationCard(notif, notificationProvider)),
                            const SizedBox(height: 32),
                          ],
                          // Earlier Section
                          if (earlierNotifications.isNotEmpty) ...[
                            Text(
                              'EARLIER',
                              style: TextStyle(
                                color: Colors.grey[500],
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.5,
                              ),
                            ),
                            const SizedBox(height: 16),
                            ...earlierNotifications.map((notif) =>
                                _buildNotificationCard(notif, notificationProvider)),
                          ],
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
          ),
        );
      },
    );
  }

  Widget _buildNotificationCard(
    Map<String, dynamic> notif,
    NotificationProvider provider,
  ) {
    final type = (notif['type'] as String? ?? 'System').toLowerCase();
    final isRead = notif['read'] == true;
    final title = notif['title'] as String? ?? '';
    final body = notif['body'] as String? ?? '';
    final createdAt = notif['createdAt'];
    String timeStr = '';
    
    if (createdAt != null) {
      try {
        final timestamp = createdAt as Timestamp?;
        if (timestamp != null) {
          final now = DateTime.now();
          final created = timestamp.toDate();
          final diff = now.difference(created);
          
          if (diff.inMinutes < 60) {
            timeStr = '${diff.inMinutes}m ago';
          } else if (diff.inHours < 24) {
            timeStr = '${diff.inHours}h ago';
          } else {
            timeStr = '${diff.inDays}d ago';
          }
        }
      } catch (e) {
        timeStr = '';
      }
    }
    
    final iconData = _getNotificationIcon(type);
    final iconColor = _getNotificationColor(type);
    final iconBg = _getNotificationBg(type);

    return GestureDetector(
      onTap: () {
        if (!isRead) {
          provider.markAsRead(notif['id'] as String);
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isRead
              ? AppColors.surfaceDark.withValues(alpha: 0.5)
              : AppColors.surfaceDark,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: isRead
                ? Colors.white.withValues(alpha: 0.05)
                : AppColors.primary.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.05),
                ),
              ),
              child: Icon(
                iconData,
                color: iconColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: TextStyle(
                            color: isRead
                                ? Colors.grey[400]
                                : Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      if (!isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        )
                      else if (timeStr.isNotEmpty)
                        Text(
                          timeStr,
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    body,
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                  if (notif['actionText'] != null) ...[
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: () {
                        final actionUrl = notif['actionUrl'] as String?;
                        if (actionUrl != null) {
                          // Handle navigation
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        (notif['actionText'] as String).toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getNotificationIcon(String type) {
    switch (type.toLowerCase()) {
      case 'booking':
      case 'match':
        return Icons.sports_soccer;
      case 'promotion':
      case 'offer':
        return Icons.local_offer;
      case 'invite':
        return Icons.group_add;
      case 'announcement':
      case 'system':
      default:
        return Icons.settings_suggest;
    }
  }

  Color _getNotificationColor(String type) {
    switch (type.toLowerCase()) {
      case 'booking':
      case 'match':
        return AppColors.primary;
      case 'promotion':
      case 'offer':
        return Colors.amber;
      case 'invite':
        return Colors.blue;
      case 'announcement':
      case 'system':
      default:
        return Colors.grey;
    }
  }

  Color _getNotificationBg(String type) {
    switch (type.toLowerCase()) {
      case 'booking':
      case 'match':
        return AppColors.primary.withValues(alpha: 0.1);
      case 'promotion':
      case 'offer':
        return Colors.amber.withValues(alpha: 0.1);
      case 'invite':
        return Colors.blue.withValues(alpha: 0.1);
      case 'announcement':
      case 'system':
      default:
        return Colors.white.withValues(alpha: 0.05);
    }
  }
}
