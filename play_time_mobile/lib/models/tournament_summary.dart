import 'package:cloud_firestore/cloud_firestore.dart';

class TournamentSummary {
  final String id;
  final String name;
  final String? description;
  final String sport;
  final String venueId;
  final String? venueName;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? registrationEndDate;
  final double entryFee;
  final String status;
  final int? maxTeams;
  final int teamCount;

  TournamentSummary({
    required this.id,
    required this.name,
    this.description,
    required this.sport,
    required this.venueId,
    this.venueName,
    this.startDate,
    this.endDate,
    this.registrationEndDate,
    required this.entryFee,
    required this.status,
    this.maxTeams,
    this.teamCount = 0,
  });

  bool get canRegister =>
      status == 'Open' &&
      (registrationEndDate == null ||
          registrationEndDate!.isAfter(DateTime.now()));

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

    return TournamentSummary(
      id: id,
      name: data['name'] as String? ?? 'Tournament',
      description: data['description'] as String?,
      sport: data['sport'] as String? ?? '',
      venueId: data['venueId'] as String? ?? '',
      venueName: data['venueName'] as String?,
      startDate: parse(data['startDate']),
      endDate: parse(data['endDate']),
      registrationEndDate: parse(data['registrationEndDate']),
      entryFee: (data['entryFee'] as num?)?.toDouble() ?? 0,
      status: data['status'] as String? ?? 'Draft',
      maxTeams: (data['maxTeams'] as num?)?.toInt(),
      teamCount: teamCount,
    );
  }
}
