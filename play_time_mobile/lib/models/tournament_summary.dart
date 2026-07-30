import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

class TournamentSummary {
  final String id;
  final String name;
  final String? description;
  final String sport;
  final String venueId;
  final String? venueName;
  final String? venueAddress;
  final String? bannerImage;
  final String? organizer;
  final String? rules;
  final String? startTime;
  final String? endTime;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? registrationEndDate;
  final double entryFee;
  final double? prizePool;
  final String status;
  final int? maxTeams;
  final int teamCount;
  final double? venueLat;
  final double? venueLng;

  TournamentSummary({
    required this.id,
    required this.name,
    this.description,
    required this.sport,
    required this.venueId,
    this.venueName,
    this.venueAddress,
    this.bannerImage,
    this.organizer,
    this.rules,
    this.startTime,
    this.endTime,
    this.startDate,
    this.endDate,
    this.registrationEndDate,
    required this.entryFee,
    this.prizePool,
    required this.status,
    this.maxTeams,
    this.teamCount = 0,
    this.venueLat,
    this.venueLng,
  });

  bool get isFull => maxTeams != null && teamCount >= maxTeams!;

  bool get canRegister {
    if (status != 'Open') return false;
    if (isFull) return false;
    if (registrationEndDate != null &&
        !registrationEndDate!.isAfter(DateTime.now())) {
      return false;
    }
    return true;
  }

  /// Display labels matching product requirements.
  String get registrationStatusLabel {
    if (status == 'Completed' || status == 'Cancelled') {
      return 'Tournament Completed';
    }
    if (status == 'Ongoing') return 'Tournament Completed';
    if (isFull) return 'Tournament Full';
    if (status == 'Registration Closed' ||
        (registrationEndDate != null &&
            !registrationEndDate!.isAfter(DateTime.now()))) {
      return 'Registration Closed';
    }
    if (status == 'Open') return 'Registration Open';
    return status;
  }

  String get displayVenueName {
    final n = venueName?.trim();
    if (n != null && n.isNotEmpty && n.toLowerCase() != 'venue') return n;
    return 'Venue TBA';
  }

  String get formattedDate {
    if (startDate == null) return 'Date TBA';
    return DateFormat('d MMMM yyyy').format(startDate!);
  }

  String get formattedTimeRange {
    final start = _formatClock(startTime);
    final end = _formatClock(endTime);
    if (start != null && end != null) return '$start – $end';
    if (start != null) return start;
    return 'Time TBA';
  }

  static String? _formatClock(String? hhmm) {
    if (hhmm == null || hhmm.trim().isEmpty) return null;
    final parts = hhmm.split(':');
    if (parts.length < 2) return hhmm;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return hhmm;
    final dt = DateTime(2000, 1, 1, h, m);
    return DateFormat('h:mm a').format(dt);
  }

  factory TournamentSummary.fromFirestore(
    String id,
    Map<String, dynamic> data,
  ) {
    DateTime? parse(dynamic v) {
      if (v is Timestamp) return v.toDate();
      if (v is DateTime) return v;
      return null;
    }

    final teams = data['teams'];
    final teamCount = teams is List
        ? teams.length
        : (data['teamCount'] as num?)?.toInt() ?? 0;

    double? prizePool;
    if (data['prizePool'] is num) {
      prizePool = (data['prizePool'] as num).toDouble();
    } else if (data['prizeDetails'] is Map) {
      final p = Map<String, dynamic>.from(data['prizeDetails'] as Map);
      prizePool =
          ((p['first'] as num?)?.toDouble() ?? 0) +
          ((p['second'] as num?)?.toDouble() ?? 0) +
          ((p['third'] as num?)?.toDouble() ?? 0);
      if (prizePool == 0) prizePool = null;
    }

    return TournamentSummary(
      id: id,
      name: data['name'] as String? ?? 'Tournament',
      description: data['description'] as String?,
      sport: data['sport'] as String? ?? '',
      venueId: data['venueId'] as String? ?? '',
      venueName: data['venueName'] as String?,
      venueAddress: data['venueAddress'] as String?,
      bannerImage: data['bannerImage'] as String?,
      organizer: data['organizer'] as String?,
      rules: data['rules'] as String?,
      startTime: data['startTime'] as String?,
      endTime: data['endTime'] as String?,
      startDate: parse(data['startDate']),
      endDate: parse(data['endDate']),
      registrationEndDate: parse(data['registrationEndDate']),
      entryFee: (data['entryFee'] as num?)?.toDouble() ?? 0,
      prizePool: prizePool,
      status: data['status'] as String? ?? 'Draft',
      maxTeams: (data['maxTeams'] as num?)?.toInt(),
      teamCount: teamCount,
      venueLat: (data['venueLat'] as num?)?.toDouble(),
      venueLng: (data['venueLng'] as num?)?.toDouble(),
    );
  }
}
