import 'package:flutter/foundation.dart';
import '../models/sport.dart';
import '../services/firestore_service.dart';

class SportProvider with ChangeNotifier {
  List<Sport> _sports = [];
  bool _isLoading = false;
  String? _error;

  List<Sport> get sports => _sports;
  bool get isLoading => _isLoading;
  String? get error => _error;

  SportProvider() {
    loadSports();
  }

  Future<void> loadSports({bool forceReload = false}) async {
    // Don't reload if already loaded and not forcing
    if (!forceReload && _sports.isNotEmpty && !_isLoading) {
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final sportsData = await FirestoreService.getSports();
      _sports = sportsData.map((data) {
        return Sport.fromFirestore(
          Map<String, dynamic>.from(data),
          data['id'] as String,
        );
      }).toList();
      
      // Sort by order if available, then by name
      _sports.sort((a, b) {
        if (a.order != null && b.order != null) {
          return a.order!.compareTo(b.order!);
        }
        if (a.order != null) return -1;
        if (b.order != null) return 1;
        return a.name.compareTo(b.name);
      });
    } catch (e) {
      _error = 'Failed to load sports: $e';
      print('Error loading sports: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Sport? getSportById(String id) {
    try {
      return _sports.firstWhere((sport) => sport.id == id);
    } catch (e) {
      return null;
    }
  }

  Sport? getSportByName(String name) {
    try {
      return _sports.firstWhere((sport) => sport.name.toLowerCase() == name.toLowerCase());
    } catch (e) {
      return null;
    }
  }
}

