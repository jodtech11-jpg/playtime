import 'package:cloud_firestore/cloud_firestore.dart';

class Booking {
  final String id;
  final String? venueId;
  final String venueName;
  final String? venueImage;
  final String date;
  final String time;
  final double amount;
  final String sport;
  final String? courtName;
  final BookingStatus status;
  final bool isFirstTimeBooking;

  String get shortId =>
      id.length >= 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase();

  String get referenceId => id.isEmpty ? '—' : '#$shortId';

  static bool _looksLikeRawId(String value) {
    final compact = value.trim().replaceAll(RegExp(r'\s+'), '');
    return compact.length >= 12 && RegExp(r'^[a-zA-Z0-9]+$').hasMatch(compact);
  }

  /// Display-safe sport name (guards against unhandled raw Firestore document IDs like MLVW5RGFTOXW5V1GMV4M)
  String get displaySport {
    final s = sport.trim();
    if (s.isEmpty || _looksLikeRawId(s)) return 'SPORT';
    return s;
  }

  /// Display-safe court name (guards against unhandled raw Firestore document IDs)
  String? get displayCourtName {
    final c = courtName?.trim();
    if (c == null || c.isEmpty || _looksLikeRawId(c)) return null;
    return c;
  }

  /// Display-safe title for cards/headers (court name -> displaySport -> 'Court booking')
  String get displayTitle {
    final court = displayCourtName;
    if (court != null && court.isNotEmpty) return court;
    final s = displaySport;
    if (s != 'SPORT' && s.isNotEmpty) return s;
    return 'Court booking';
  }

  Booking({
    required this.id,
    this.venueId,
    required this.venueName,
    this.venueImage,
    required this.date,
    required this.time,
    required this.amount,
    required this.sport,
    this.courtName,
    required this.status,
    this.isFirstTimeBooking = false,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['id'] as String,
      venueId: json['venueId'] as String?,
      venueName: json['venueName'] as String,
      venueImage: json['venueImage'] as String?,
      date: json['date'] as String,
      time: json['time'] as String,
      amount: (json['amount'] as num).toDouble(),
      sport: json['sport'] as String,
      courtName: json['courtName'] as String?,
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
        time =
            '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      }
    }

    if (time.isEmpty && data['time'] != null) {
      time = data['time'] as String;
    }

    final rawCourt = data['courtName'] as String? ?? data['court'] as String?;

    return Booking(
      id: id,
      venueId: data['venueId'] as String?,
      venueName: data['venue'] as String? ?? data['venueName'] as String? ?? '',
      venueImage: data['venueImage'] as String?,
      date: date,
      time: time,
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      sport: data['sport'] as String? ?? '',
      courtName: rawCourt,
      status: (data['paymentStatus'] == 'Paid' || data['status'] == 'Confirmed')
          ? BookingStatus.confirmed
          : BookingStatus.fromString(data['status'] as String? ?? 'Pending'),
      isFirstTimeBooking: data['isFirstTimeBooking'] as bool? ?? false,
    );
  }

  static String _getMonthName(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[month - 1];
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'venueId': venueId,
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
