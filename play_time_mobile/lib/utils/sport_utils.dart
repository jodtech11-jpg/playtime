import 'package:flutter/material.dart';
import '../models/sport.dart';

/// Shared helpers for sport cards (images, colors, icons).
class SportUtils {
  static Color parseSportColor(
    String? colorHex, {
    Color fallback = const Color(0xFF1A1A1A),
  }) {
    if (colorHex == null || colorHex.isEmpty) return fallback;
    try {
      var hex = colorHex.replaceFirst('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  static String? resolveImageUrl(Sport sport) {
    if (sport.imageUrl != null && sport.imageUrl!.isNotEmpty) {
      return sport.imageUrl;
    }
    return _defaultImages[sport.name.toLowerCase()];
  }

  static IconData iconForSport(String name) {
    switch (name.toLowerCase()) {
      case 'cricket':
        return Icons.sports_cricket;
      case 'football':
        return Icons.sports_soccer;
      case 'badminton':
      case 'tennis':
        return Icons.sports_tennis;
      case 'basketball':
        return Icons.sports_basketball;
      case 'volleyball':
        return Icons.sports_volleyball;
      case 'swimming':
        return Icons.pool;
      case 'hockey':
        return Icons.sports_hockey;
      default:
        return Icons.sports;
    }
  }

  static const Map<String, String> _defaultImages = {
    'badminton':
        'https://images.unsplash.com/photo-1626224583764-f87db7ef1b32?w=800&q=80',
    'cricket':
        'https://images.unsplash.com/photo-1531415078268-6bdfe71d7d85?w=800&q=80',
    'football':
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'basketball':
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
    'tennis':
        'https://images.unsplash.com/photo-1554068865-24cecd4e24de?w=800&q=80',
    'volleyball':
        'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
    'swimming':
        'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80',
  };
}

/// Formats court operating hours for display.
String formatOperatingHours(String start24, String end24) {
  String fmt(String t) {
    final parts = t.split(':');
    final h = int.parse(parts[0]);
    final m = parts.length > 1 ? parts[1] : '00';
    final period = h >= 12 ? 'PM' : 'AM';
    final dh = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    return '$dh:$m $period';
  }

  return '${fmt(start24)} – ${fmt(end24)}';
}
