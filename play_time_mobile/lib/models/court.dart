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

  /// Normalize day key to 'Monday' style (capitalized) for consistent lookup
  static String _normalizeDayKey(String day) {
    if (day.isEmpty) return day;
    return day[0].toUpperCase() + day.substring(1).toLowerCase();
  }

  static const List<String> _daysOfWeek = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  factory Court.fromFirestore(String id, Map<String, dynamic> data) {
    final availabilityData =
        data['availability'] as Map<String, dynamic>? ?? {};
    final availability = <String, CourtAvailability>{};

    availabilityData.forEach((day, value) {
      if (value is Map) {
        final normalizedDay = _normalizeDayKey(day.toString());
        final rawSlots = value['slots'];
        final parsedSlots = <TimeSlotRange>[];
        if (rawSlots is List) {
          for (final item in rawSlots) {
            if (item is Map) {
              final s = item['start'] as String? ?? '08:00';
              final e = item['end'] as String? ?? '22:00';
              parsedSlots.add(TimeSlotRange(start: s, end: e));
            }
          }
        }
        final defaultStart = value['start'] as String? ??
            (parsedSlots.isNotEmpty ? parsedSlots.first.start : '08:00');
        final defaultEnd = value['end'] as String? ??
            (parsedSlots.isNotEmpty ? parsedSlots.last.end : '22:00');

        availability[normalizedDay] = CourtAvailability(
          start: defaultStart,
          end: defaultEnd,
          available: value['available'] as bool? ?? true,
          slots: parsedSlots.isNotEmpty
              ? parsedSlots
              : [TimeSlotRange(start: defaultStart, end: defaultEnd)],
        );
      }
    });

    // If no availability parsed (e.g. wrong shape or empty), default to all days 08:00-22:00
    if (availability.isEmpty) {
      for (final day in _daysOfWeek) {
        availability[day] = CourtAvailability(
          start: '08:00',
          end: '22:00',
          available: true,
          slots: [TimeSlotRange(start: '08:00', end: '22:00')],
        );
      }
    }

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
        'slots': avail.slots.map((s) => {'start': s.start, 'end': s.end}).toList(),
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

class TimeSlotRange {
  final String start; // Format: "HH:MM" (24-hour)
  final String end; // Format: "HH:MM" (24-hour)

  TimeSlotRange({required this.start, required this.end});

  (int hour, int minute) parseTime(String time) {
    final parts = time.split(':');
    return (int.parse(parts[0]), int.parse(parts[1]));
  }

  bool isTimeWithin(int hour, int minute) {
    final (startHour, startMinute) = parseTime(start);
    final (endHour, endMinute) = parseTime(end);

    final slotTime = hour * 60 + minute;
    final startTime = startHour * 60 + startMinute;
    var endTime = endHour * 60 + endMinute;

    if (endTime <= startTime) {
      endTime += 1440;
      final slotTimeEffective = slotTime < startTime ? slotTime + 1440 : slotTime;
      return slotTimeEffective >= startTime && slotTimeEffective < endTime;
    }

    return slotTime >= startTime && slotTime < endTime;
  }
}

class CourtAvailability {
  final String start; // Format: "HH:MM" (24-hour)
  final String end; // Format: "HH:MM" (24-hour)
  final bool available;
  final List<TimeSlotRange> slots;

  CourtAvailability({
    required this.start,
    required this.end,
    required this.available,
    List<TimeSlotRange>? slots,
  }) : slots = slots ?? [TimeSlotRange(start: start, end: end)];

  /// Parse time string "HH:MM" to hours and minutes
  (int hour, int minute) parseTime(String time) {
    final parts = time.split(':');
    return (int.parse(parts[0]), int.parse(parts[1]));
  }

  /// Check if a time slot is within availability range
  bool isTimeSlotAvailable(int hour, int minute) {
    if (!available) return false;
    if (slots.isNotEmpty) {
      for (final slotRange in slots) {
        if (slotRange.isTimeWithin(hour, minute)) {
          return true;
        }
      }
      return false;
    }

    final (startHour, startMinute) = parseTime(start);
    final (endHour, endMinute) = parseTime(end);

    final slotTime = hour * 60 + minute;
    final startTime = startHour * 60 + startMinute;
    var endTime = endHour * 60 + endMinute;

    if (endTime <= startTime) {
      endTime += 1440;
      final slotTimeEffective = slotTime < startTime ? slotTime + 1440 : slotTime;
      return slotTimeEffective >= startTime && slotTimeEffective < endTime;
    }

    return slotTime >= startTime && slotTime < endTime;
  }
}
