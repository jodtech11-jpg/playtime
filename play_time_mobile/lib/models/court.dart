class Court {
  final String id;
  final String venueId;
  final String name;
  final String sport;
  final String type;
  final double pricePerHour;
  final Map<String, CourtAvailability> availability;
  final String status; // 'Active' | 'Maintenance' | 'Inactive';

  Court({
    required this.id,
    required this.venueId,
    required this.name,
    required this.sport,
    required this.type,
    required this.pricePerHour,
    required this.availability,
    required this.status,
  });

  factory Court.fromFirestore(String id, Map<String, dynamic> data) {
    final availabilityData = data['availability'] as Map<String, dynamic>? ?? {};
    final availability = <String, CourtAvailability>{};
    
    availabilityData.forEach((day, value) {
      if (value is Map) {
        availability[day] = CourtAvailability(
          start: value['start'] as String? ?? '08:00',
          end: value['end'] as String? ?? '22:00',
          available: value['available'] as bool? ?? true,
        );
      }
    });

    return Court(
      id: id,
      venueId: data['venueId'] as String? ?? '',
      name: data['name'] as String? ?? '',
      sport: data['sport'] as String? ?? '',
      type: data['type'] as String? ?? '',
      pricePerHour: (data['pricePerHour'] as num?)?.toDouble() ?? 0.0,
      availability: availability,
      status: data['status'] as String? ?? 'Active',
    );
  }

  Map<String, dynamic> toJson() {
    final availabilityJson = <String, dynamic>{};
    availability.forEach((day, avail) {
      availabilityJson[day] = {
        'start': avail.start,
        'end': avail.end,
        'available': avail.available,
      };
    });

    return {
      'id': id,
      'venueId': venueId,
      'name': name,
      'sport': sport,
      'type': type,
      'pricePerHour': pricePerHour,
      'availability': availabilityJson,
      'status': status,
    };
  }

  /// Check if court is available on a specific day
  bool isAvailableOnDay(String dayName) {
    final dayAvail = availability[dayName];
    if (dayAvail == null) return false;
    return dayAvail.available && status == 'Active';
  }

  /// Get available time range for a day
  CourtAvailability? getAvailabilityForDay(String dayName) {
    return availability[dayName];
  }
}

class CourtAvailability {
  final String start; // Format: "HH:MM" (24-hour)
  final String end; // Format: "HH:MM" (24-hour)
  final bool available;

  CourtAvailability({
    required this.start,
    required this.end,
    required this.available,
  });

  /// Parse time string "HH:MM" to hours and minutes
  (int hour, int minute) parseTime(String time) {
    final parts = time.split(':');
    return (int.parse(parts[0]), int.parse(parts[1]));
  }

  /// Check if a time slot is within availability range
  bool isTimeSlotAvailable(int hour, int minute) {
    if (!available) return false;
    
    final (startHour, startMinute) = parseTime(start);
    final (endHour, endMinute) = parseTime(end);
    
    final slotTime = hour * 60 + minute;
    final startTime = startHour * 60 + startMinute;
    final endTime = endHour * 60 + endMinute;
    
    return slotTime >= startTime && slotTime < endTime;
  }
}

