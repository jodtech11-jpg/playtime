class NotificationItem {
  final String id;
  final NotificationType type;
  final String title;
  final String message;
  final String time;
  final bool isRead;
  final String? actionLabel;

  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.time,
    required this.isRead,
    this.actionLabel,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      type: NotificationType.fromString(json['type'] as String),
      title: json['title'] as String,
      message: json['message'] as String,
      time: json['time'] as String,
      isRead: json['isRead'] as bool,
      actionLabel: json['actionLabel'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.toString(),
      'title': title,
      'message': message,
      'time': time,
      'isRead': isRead,
      'actionLabel': actionLabel,
    };
  }
}

enum NotificationType {
  match,
  offer,
  invite,
  system;

  static NotificationType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'match':
        return NotificationType.match;
      case 'offer':
        return NotificationType.offer;
      case 'invite':
        return NotificationType.invite;
      case 'system':
        return NotificationType.system;
      default:
        return NotificationType.system;
    }
  }

  @override
  String toString() {
    switch (this) {
      case NotificationType.match:
        return 'match';
      case NotificationType.offer:
        return 'offer';
      case NotificationType.invite:
        return 'invite';
      case NotificationType.system:
        return 'system';
    }
  }
}

