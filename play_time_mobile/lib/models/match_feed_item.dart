import 'package:cloud_firestore/cloud_firestore.dart';

class MatchFeedItem {
  final String id;
  final MatchFeedType type;
  final String title;
  final String time;
  final TeamData teamA;
  final TeamData teamB;
  final String description;
  final int likes;
  final int comments;
  final String? imageUrl;

  MatchFeedItem({
    required this.id,
    required this.type,
    required this.title,
    required this.time,
    required this.teamA,
    required this.teamB,
    required this.description,
    required this.likes,
    required this.comments,
    this.imageUrl,
  });

  factory MatchFeedItem.fromJson(Map<String, dynamic> json) {
    return MatchFeedItem(
      id: json['id'] as String,
      type: MatchFeedType.fromString(json['type'] as String),
      title: json['title'] as String,
      time: json['time'] as String,
      teamA: TeamData.fromJson(json['teamA'] as Map<String, dynamic>),
      teamB: TeamData.fromJson(json['teamB'] as Map<String, dynamic>),
      description: json['description'] as String,
      likes: json['likes'] as int,
      comments: json['comments'] as int,
      imageUrl: json['imageUrl'] as String?,
    );
  }

  factory MatchFeedItem.fromFirestore(String id, Map<String, dynamic> data) {
    final matchResult = data['matchResult'] as Map<String, dynamic>?;
    final createdAt = data['createdAt'] as Timestamp?;
    
    String timeStr = '';
    if (createdAt != null) {
      final now = DateTime.now();
      final created = createdAt.toDate();
      final diff = now.difference(created);
      
      if (diff.inMinutes < 60) {
        timeStr = '${diff.inMinutes} minutes ago';
      } else if (diff.inHours < 24) {
        timeStr = '${diff.inHours} hours ago';
      } else {
        timeStr = '${diff.inDays} days ago';
      }
    }
    
    MatchFeedType feedType = MatchFeedType.result;
    if (matchResult != null) {
      final status = matchResult['status'] as String?;
      if (status == 'Live') {
        feedType = MatchFeedType.live;
      }
    } else {
      feedType = MatchFeedType.post;
    }
    
    TeamData teamA;
    TeamData teamB;
    
    if (matchResult != null) {
      final teamAData = matchResult['teamA'] as Map<String, dynamic>? ?? {};
      final teamBData = matchResult['teamB'] as Map<String, dynamic>? ?? {};
      
      teamA = TeamData(
        name: teamAData['name'] as String? ?? '',
        icon: teamAData['icon'] as String? ?? '⚽',
        score: teamAData['score'] as int?,
        logo: teamAData['logo'] as String?,
      );
      
      teamB = TeamData(
        name: teamBData['name'] as String? ?? '',
        icon: teamBData['icon'] as String? ?? '⚽',
        score: teamBData['score'] as int?,
        logo: teamBData['logo'] as String?,
      );
    } else {
      teamA = TeamData(name: '', icon: '⚽');
      teamB = TeamData(name: '', icon: '⚽');
    }
    
    return MatchFeedItem(
      id: id,
      type: feedType,
      title: data['userName'] as String? ?? data['venueId'] as String? ?? 'Match Update',
      time: feedType == MatchFeedType.live ? 'Live • Just now' : '$timeStr',
      teamA: teamA,
      teamB: teamB,
      description: data['content'] as String? ?? '',
      likes: data['likes'] as int? ?? 0,
      comments: data['comments'] as int? ?? 0,
      imageUrl: data['imageUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.toString(),
      'title': title,
      'time': time,
      'teamA': teamA.toJson(),
      'teamB': teamB.toJson(),
      'description': description,
      'likes': likes,
      'comments': comments,
      'imageUrl': imageUrl,
    };
  }
}

class TeamData {
  final String name;
  final String icon;
  final int? score;
  final String? logo;

  TeamData({
    required this.name,
    required this.icon,
    this.score,
    this.logo,
  });

  factory TeamData.fromJson(Map<String, dynamic> json) {
    return TeamData(
      name: json['name'] as String,
      icon: json['icon'] as String,
      score: json['score'] as int?,
      logo: json['logo'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'icon': icon,
      'score': score,
      'logo': logo,
    };
  }
}

enum MatchFeedType {
  live,
  result,
  post;

  static MatchFeedType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'live':
        return MatchFeedType.live;
      case 'result':
        return MatchFeedType.result;
      case 'post':
        return MatchFeedType.post;
      default:
        return MatchFeedType.result;
    }
  }

  @override
  String toString() {
    switch (this) {
      case MatchFeedType.live:
        return 'live';
      case MatchFeedType.result:
        return 'result';
      case MatchFeedType.post:
        return 'post';
    }
  }
}

