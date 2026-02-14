import 'package:cloud_firestore/cloud_firestore.dart';

class Booking {
  final String id;
  final String venueName;
  final String? venueImage;
  final String date;
  final String time;
  final double amount;
  final String sport;
  final BookingStatus status;
  final bool isFirstTimeBooking;

  Booking({
    required this.id,
    required this.venueName,
    this.venueImage,
    required this.date,
    required this.time,
    required this.amount,
    required this.sport,
    required this.status,
    this.isFirstTimeBooking = false,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['id'] as String,
      venueName: json['venueName'] as String,
      venueImage: json['venueImage'] as String?,
      date: json['date'] as String,
      time: json['time'] as String,
      amount: (json['amount'] as num).toDouble(),
      sport: json['sport'] as String,
      status: BookingStatus.fromString(json['status'] as String),
      isFirstTimeBooking: json['isFirstTimeBooking'] as bool? ?? false,
    );
  }

  factory Booking.fromFirestore(String id, Map<String, dynamic> data) {
    // Format date and time from Firestore timestamps
    String date = '';
    String time = '';
    
    if (data['date'] != null) {
      date = data['date'] as String;
    } else if (data['startTime'] != null) {
      final startTime = data['startTime'] as Timestamp?;
      if (startTime != null) {
        final dt = startTime.toDate();
        date = '${dt.day} ${_getMonthName(dt.month)}, ${dt.year}';
        time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      }
    }
    
    if (time.isEmpty && data['time'] != null) {
      time = data['time'] as String;
    }

    return Booking(
      id: id,
      venueName: data['venue'] as String? ?? data['venueName'] as String? ?? '',
      venueImage: data['venueImage'] as String?,
      date: date,
      time: time,
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      sport: data['sport'] as String? ?? '',
      status: BookingStatus.fromString(data['status'] as String? ?? 'Pending'),
      isFirstTimeBooking: data['isFirstTimeBooking'] as bool? ?? false,
    );
  }

  static String _getMonthName(int month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'venueName': venueName,
      'venueImage': venueImage,
      'date': date,
      'time': time,
      'amount': amount,
      'sport': sport,
      'status': status.toString(),
      'isFirstTimeBooking': isFirstTimeBooking,
    };
  }
}

enum BookingStatus {
  pending,
  confirmed,
  completed,
  cancelled;

  static BookingStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'pending':
        return BookingStatus.pending;
      case 'confirmed':
        return BookingStatus.confirmed;
      case 'completed':
        return BookingStatus.completed;
      case 'cancelled':
        return BookingStatus.cancelled;
      case 'upcoming': // Backward compatibility
        return BookingStatus.confirmed;
      default:
        return BookingStatus.pending;
    }
  }

  @override
  String toString() {
    switch (this) {
      case BookingStatus.pending:
        return 'Pending';
      case BookingStatus.confirmed:
        return 'Confirmed';
      case BookingStatus.completed:
        return 'Completed';
      case BookingStatus.cancelled:
        return 'Cancelled';
    }
  }
  
  bool get isUpcoming {
    return this == BookingStatus.confirmed || this == BookingStatus.pending;
  }
}

