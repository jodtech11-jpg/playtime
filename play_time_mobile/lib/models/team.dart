import 'package:cloud_firestore/cloud_firestore.dart';

class Team {
  final String id;
  final String name;
  final String sport;
  final String logo;
  final int matchesWon;
  final List<TeamMember> members;
  final String createdBy;
  final DateTime? trainingAt;
  final String? trainingVenue;
  final String? trainingNotes;

  Team({
    required this.id,
    required this.name,
    required this.sport,
    required this.logo,
    required this.matchesWon,
    required this.members,
    this.createdBy = '',
    this.trainingAt,
    this.trainingVenue,
    this.trainingNotes,
  });

  factory Team.fromJson(Map<String, dynamic> json) {
    return Team(
      id: json['id'] as String,
      name: json['name'] as String,
      sport: json['sport'] as String,
      logo: json['logo'] as String,
      matchesWon: json['matchesWon'] as int,
      members: (json['members'] as List)
          .map((m) => TeamMember.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }

  factory Team.fromFirestore(String id, Map<String, dynamic> data) {
    final members = data['members'] as List<dynamic>? ?? [];
    final memberRoles = Map<String, dynamic>.from(
      data['memberRoles'] as Map? ?? const {},
    );

    return Team(
      id: id,
      name: data['name'] as String? ?? '',
      sport: data['sport'] as String? ?? '',
      logo: data['logo'] as String? ?? '⚽',
      matchesWon: data['matchesWon'] as int? ?? 0,
      members: members.map((m) {
        TeamMember member;
        if (m is Map<String, dynamic>) {
          member = TeamMember.fromJson(m);
        } else if (m is Map) {
          member = TeamMember.fromJson(Map<String, dynamic>.from(m));
        } else if (m is String) {
          // If member is just a user ID, create a basic member
          member = TeamMember(
            id: m,
            name: '',
            avatar: '',
            role: 'Member',
            status: 'Joined',
          );
        } else {
          member = TeamMember(
            id: '',
            name: '',
            avatar: '',
            role: 'Member',
            status: 'Joined',
          );
        }
        final savedRole = memberRoles[member.id]?.toString();
        if (savedRole == null || savedRole.isEmpty) return member;
        return TeamMember(
          id: member.id,
          name: member.name,
          avatar: member.avatar,
          role: savedRole,
          status: member.status,
        );
      }).toList(),
      createdBy: data['createdBy'] as String? ?? '',
      trainingAt: data['trainingAt'] is Timestamp
          ? (data['trainingAt'] as Timestamp).toDate()
          : data['trainingAt'] as DateTime?,
      trainingVenue: data['trainingVenue'] as String?,
      trainingNotes: data['trainingNotes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'sport': sport,
      'logo': logo,
      'matchesWon': matchesWon,
      'members': members.map((m) => m.toJson()).toList(),
      'createdBy': createdBy,
      'trainingAt': trainingAt,
      'trainingVenue': trainingVenue,
      'trainingNotes': trainingNotes,
    };
  }
}

class TeamMember {
  final String id;
  final String name;
  final String avatar;
  final String role;
  final String status;

  TeamMember({
    required this.id,
    required this.name,
    required this.avatar,
    required this.role,
    required this.status,
  });

  factory TeamMember.fromJson(Map<String, dynamic> json) {
    return TeamMember(
      id: json['id'] as String,
      name: json['name'] as String,
      avatar: json['avatar'] as String,
      role: json['role'] as String,
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatar': avatar,
      'role': role,
      'status': status,
    };
  }
}
