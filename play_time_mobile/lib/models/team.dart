class Team {
  final String id;
  final String name;
  final String sport;
  final String logo;
  final int matchesWon;
  final List<TeamMember> members;

  Team({
    required this.id,
    required this.name,
    required this.sport,
    required this.logo,
    required this.matchesWon,
    required this.members,
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
    
    return Team(
      id: id,
      name: data['name'] as String? ?? '',
      sport: data['sport'] as String? ?? '',
      logo: data['logo'] as String? ?? '⚽',
      matchesWon: data['matchesWon'] as int? ?? 0,
      members: members.map((m) {
        if (m is Map<String, dynamic>) {
          return TeamMember.fromJson(m);
        } else if (m is Map) {
          return TeamMember.fromJson(Map<String, dynamic>.from(m));
        } else if (m is String) {
          // If member is just a user ID, create a basic member
          return TeamMember(
            id: m,
            name: '',
            avatar: '',
            role: 'Member',
            status: 'Joined',
          );
        }
        return TeamMember(
          id: '',
          name: '',
          avatar: '',
          role: 'Member',
          status: 'Joined',
        );
      }).toList(),
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

