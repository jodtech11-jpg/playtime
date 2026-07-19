import 'package:cloud_firestore/cloud_firestore.dart';

class QuickMatch {
  final String id;
  final String venueId;
  final String? venueName;
  final String sport;
  final String? courtId;
  final String? courtName;
  final DateTime? date;
  final String time;
  final int maxPlayers;
  final int currentPlayers;
  final List<String> playerIds;
  final String status;
  final String createdBy;

  QuickMatch({
    required this.id,
    required this.venueId,
    this.venueName,
    required this.sport,
    this.courtId,
    this.courtName,
    this.date,
    required this.time,
    required this.maxPlayers,
    required this.currentPlayers,
    required this.playerIds,
    required this.status,
    required this.createdBy,
  });

  bool get isJoinable => status == 'Open' && currentPlayers < maxPlayers;

  bool hasJoined(String userId) => playerIds.contains(userId);

  factory QuickMatch.fromFirestore(String id, Map<String, dynamic> data) {
    DateTime? date;
    final rawDate = data['date'];
    if (rawDate is Timestamp) {
      date = rawDate.toDate();
    } else if (rawDate is DateTime) {
      date = rawDate;
    }

    return QuickMatch(
      id: id,
      venueId: data['venueId'] as String? ?? '',
      venueName: data['venueName'] as String?,
      sport: data['sport'] as String? ?? '',
      courtId: data['courtId'] as String?,
      courtName: data['courtName'] as String?,
      date: date,
      time: data['time'] as String? ?? '',
      maxPlayers: (data['maxPlayers'] as num?)?.toInt() ?? 0,
      currentPlayers: (data['currentPlayers'] as num?)?.toInt() ?? 0,
      playerIds: List<String>.from(data['playerIds'] as List? ?? const []),
      status: data['status'] as String? ?? 'Open',
      createdBy: data['createdBy'] as String? ?? '',
    );
  }
}
