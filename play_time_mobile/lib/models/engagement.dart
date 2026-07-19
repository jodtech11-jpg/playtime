import 'package:cloud_firestore/cloud_firestore.dart';

class PollOption {
  final String id;
  final String text;
  final int votes;

  PollOption({required this.id, required this.text, required this.votes});

  factory PollOption.fromMap(Map<String, dynamic> data) {
    return PollOption(
      id: data['id'] as String? ?? '',
      text: data['text'] as String? ?? '',
      votes: (data['votes'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() => {'id': id, 'text': text, 'votes': votes};
}

class AppPoll {
  final String id;
  final String question;
  final List<PollOption> options;
  final String? venueId;
  final String? sport;
  final String status;
  final int totalVotes;
  final List<String> votedUserIds;

  AppPoll({
    required this.id,
    required this.question,
    required this.options,
    this.venueId,
    this.sport,
    required this.status,
    required this.totalVotes,
    required this.votedUserIds,
  });

  bool get isActive => status == 'Active';

  bool hasVoted(String userId) => votedUserIds.contains(userId);

  factory AppPoll.fromFirestore(String id, Map<String, dynamic> data) {
    final rawOptions = data['options'] as List? ?? const [];
    return AppPoll(
      id: id,
      question: data['question'] as String? ?? '',
      options: rawOptions
          .whereType<Map>()
          .map((o) => PollOption.fromMap(Map<String, dynamic>.from(o)))
          .toList(),
      venueId: data['venueId'] as String?,
      sport: data['sport'] as String?,
      status: data['status'] as String? ?? 'Active',
      totalVotes: (data['totalVotes'] as num?)?.toInt() ?? 0,
      votedUserIds: List<String>.from(
        data['votedUserIds'] as List? ?? const [],
      ),
    );
  }
}

class FlashDealItem {
  final String id;
  final String title;
  final String? description;
  final String venueId;
  final String? venueName;
  final String discountType;
  final double discountValue;
  final double originalPrice;
  final double discountedPrice;
  final DateTime? endTime;
  final String status;
  final String? imageUrl;

  FlashDealItem({
    required this.id,
    required this.title,
    this.description,
    required this.venueId,
    this.venueName,
    required this.discountType,
    required this.discountValue,
    required this.originalPrice,
    required this.discountedPrice,
    this.endTime,
    required this.status,
    this.imageUrl,
  });

  bool get isActive => status == 'Active';

  factory FlashDealItem.fromFirestore(String id, Map<String, dynamic> data) {
    DateTime? endTime;
    final raw = data['endTime'];
    if (raw is Timestamp) endTime = raw.toDate();
    if (raw is DateTime) endTime = raw;

    return FlashDealItem(
      id: id,
      title: data['title'] as String? ?? 'Flash Deal',
      description: data['description'] as String?,
      venueId: data['venueId'] as String? ?? '',
      venueName: data['venueName'] as String?,
      discountType: data['discountType'] as String? ?? 'Percentage',
      discountValue: (data['discountValue'] as num?)?.toDouble() ?? 0,
      originalPrice: (data['originalPrice'] as num?)?.toDouble() ?? 0,
      discountedPrice: (data['discountedPrice'] as num?)?.toDouble() ?? 0,
      endTime: endTime,
      status: data['status'] as String? ?? 'Upcoming',
      imageUrl: data['imageUrl'] as String?,
    );
  }
}

class MarketingCampaignItem {
  final String id;
  final String title;
  final String? description;
  final String type;
  final String? venueId;
  final String imageUrl;
  final String status;
  final String target;

  MarketingCampaignItem({
    required this.id,
    required this.title,
    this.description,
    required this.type,
    this.venueId,
    required this.imageUrl,
    required this.status,
    required this.target,
  });

  factory MarketingCampaignItem.fromFirestore(
    String id,
    Map<String, dynamic> data,
  ) {
    return MarketingCampaignItem(
      id: id,
      title: data['title'] as String? ?? 'Offer',
      description: data['description'] as String?,
      type: data['type'] as String? ?? 'Global',
      venueId: data['venueId'] as String?,
      imageUrl: data['imageUrl'] as String? ?? '',
      status: data['status'] as String? ?? 'Draft',
      target: data['target'] as String? ?? '',
    );
  }
}

class LeaderboardEntry {
  final String userId;
  final String? userName;
  final String? userAvatar;
  final double score;
  final int rank;
  final int matchesPlayed;
  final int wins;
  final int losses;

  LeaderboardEntry({
    required this.userId,
    this.userName,
    this.userAvatar,
    required this.score,
    required this.rank,
    required this.matchesPlayed,
    required this.wins,
    required this.losses,
  });

  factory LeaderboardEntry.fromMap(Map<String, dynamic> data) {
    return LeaderboardEntry(
      userId: data['userId'] as String? ?? '',
      userName: data['userName'] as String?,
      userAvatar: data['userAvatar'] as String?,
      score: (data['score'] as num?)?.toDouble() ?? 0,
      rank: (data['rank'] as num?)?.toInt() ?? 0,
      matchesPlayed: (data['matchesPlayed'] as num?)?.toInt() ?? 0,
      wins: (data['wins'] as num?)?.toInt() ?? 0,
      losses: (data['losses'] as num?)?.toInt() ?? 0,
    );
  }
}

class AppLeaderboard {
  final String id;
  final String sport;
  final String type;
  final String? venueId;
  final String? venueName;
  final List<LeaderboardEntry> entries;

  AppLeaderboard({
    required this.id,
    required this.sport,
    required this.type,
    this.venueId,
    this.venueName,
    required this.entries,
  });

  factory AppLeaderboard.fromFirestore(String id, Map<String, dynamic> data) {
    final raw = data['entries'] as List? ?? const [];
    return AppLeaderboard(
      id: id,
      sport: data['sport'] as String? ?? '',
      type: data['type'] as String? ?? 'Venue',
      venueId: data['venueId'] as String?,
      venueName: data['venueName'] as String?,
      entries:
          raw
              .whereType<Map>()
              .map(
                (e) => LeaderboardEntry.fromMap(Map<String, dynamic>.from(e)),
              )
              .toList()
            ..sort((a, b) => a.rank.compareTo(b.rank)),
    );
  }
}
