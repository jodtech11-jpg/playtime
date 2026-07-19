import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Exposes network connectivity status for offline banner and retry logic.
class ConnectivityProvider with ChangeNotifier {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  ConnectivityProvider() {
    _init();
  }

  Future<void> _init() async {
    await _check();
    _subscription = _connectivity.onConnectivityChanged.listen(_onResult);
  }

  void _onResult(List<ConnectivityResult> results) {
    final online =
        results.isNotEmpty &&
        results.any(
          (r) =>
              r == ConnectivityResult.mobile ||
              r == ConnectivityResult.wifi ||
              r == ConnectivityResult.ethernet,
        );
    if (_isOnline != online) {
      _isOnline = online;
      notifyListeners();
    }
  }

  Future<void> _check() async {
    try {
      final results = await _connectivity.checkConnectivity();
      _onResult(results);
    } catch (_) {
      _isOnline = true; // assume online on error
    }
  }

  /// Call to re-check connectivity (e.g. after Retry).
  Future<void> checkAgain() async {
    await _check();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
