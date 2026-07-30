import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

enum FeatureMode { enabled, disabledHide, disabledComingSoon }

class FeatureModuleConfig {
  final FeatureMode mode;
  final String? comingSoonTitle;
  final String? comingSoonMessage;

  const FeatureModuleConfig({
    this.mode = FeatureMode.enabled,
    this.comingSoonTitle,
    this.comingSoonMessage,
  });

  factory FeatureModuleConfig.fromMap(Map<String, dynamic>? data) {
    final raw = (data?['mode'] as String?)?.toLowerCase() ?? 'enabled';
    FeatureMode mode;
    switch (raw) {
      case 'disabled_hide':
      case 'disabledhide':
      case 'hide':
        mode = FeatureMode.disabledHide;
        break;
      case 'disabled_coming_soon':
      case 'disabledcomingsoon':
      case 'coming_soon':
      case 'comingsoon':
        mode = FeatureMode.disabledComingSoon;
        break;
      default:
        mode = FeatureMode.enabled;
    }
    return FeatureModuleConfig(
      mode: mode,
      comingSoonTitle: data?['comingSoonTitle'] as String?,
      comingSoonMessage: data?['comingSoonMessage'] as String?,
    );
  }

  bool get isEnabled => mode == FeatureMode.enabled;
  bool get isHidden => mode == FeatureMode.disabledHide;
  bool get isComingSoon => mode == FeatureMode.disabledComingSoon;
  bool get isVisible => mode != FeatureMode.disabledHide;
}

/// Super-admin controlled customer-app module visibility.
class FeatureFlagsProvider with ChangeNotifier {
  static const defaultComingSoonTitle = 'Coming Soon';
  static const defaultComingSoonMessage =
      'This feature is currently under development and will be available soon.';

  static const _moduleKeys = [
    'tournament',
    'wallet',
    'teamUp',
    'joinMatch',
    'matches',
    'communityPolls',
    'feed',
    'favourite',
    'notifications',
  ];

  final Map<String, FeatureModuleConfig> _modules = {
    for (final key in _moduleKeys) key: const FeatureModuleConfig(),
  };

  String _defaultTitle = defaultComingSoonTitle;
  String _defaultMessage = defaultComingSoonMessage;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _subscription;
  bool _loaded = false;

  bool get isLoaded => _loaded;
  String get defaultComingSoonTitleValue => _defaultTitle;
  String get defaultComingSoonMessageValue => _defaultMessage;

  FeatureModuleConfig module(String key) =>
      _modules[key] ?? const FeatureModuleConfig();

  FeatureModuleConfig get tournament => module('tournament');
  FeatureModuleConfig get wallet => module('wallet');
  FeatureModuleConfig get teamUp => module('teamUp');
  FeatureModuleConfig get joinMatch => module('joinMatch');
  FeatureModuleConfig get matches => module('matches');
  FeatureModuleConfig get communityPolls => module('communityPolls');
  FeatureModuleConfig get feed => module('feed');
  FeatureModuleConfig get favourite => module('favourite');
  FeatureModuleConfig get notifications => module('notifications');

  FeatureFlagsProvider() {
    _subscription = FirebaseFirestore.instance
        .collection('appSettings')
        .doc('public')
        .snapshots()
        .listen(
          _applySnapshot,
          onError: (Object e) {
            debugPrint('Feature flags listen error: $e');
            _loaded = true;
            notifyListeners();
          },
        );
  }

  void _applySnapshot(DocumentSnapshot<Map<String, dynamic>> snap) {
    final data = snap.data();
    final flags = data?['featureFlags'];
    if (flags is Map<String, dynamic>) {
      _defaultTitle =
          (flags['defaultComingSoonTitle'] as String?)?.trim().isNotEmpty ==
              true
          ? flags['defaultComingSoonTitle'] as String
          : defaultComingSoonTitle;
      _defaultMessage =
          (flags['defaultComingSoonMessage'] as String?)?.trim().isNotEmpty ==
              true
          ? flags['defaultComingSoonMessage'] as String
          : defaultComingSoonMessage;
      for (final key in _moduleKeys) {
        final raw = flags[key];
        _modules[key] = FeatureModuleConfig.fromMap(
          raw is Map<String, dynamic> ? raw : null,
        );
      }
    }
    _loaded = true;
    notifyListeners();
  }

  String comingSoonTitleFor(String key) {
    final custom = module(key).comingSoonTitle?.trim();
    if (custom != null && custom.isNotEmpty) return custom;
    return _defaultTitle;
  }

  String comingSoonMessageFor(String key) {
    final custom = module(key).comingSoonMessage?.trim();
    if (custom != null && custom.isNotEmpty) return custom;
    return _defaultMessage;
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
