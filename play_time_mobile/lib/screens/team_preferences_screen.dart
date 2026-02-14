import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../theme/app_colors.dart';
import '../services/firestore_service.dart';

class TeamPreferencesScreen extends StatefulWidget {
  const TeamPreferencesScreen({super.key});

  @override
  State<TeamPreferencesScreen> createState() => _TeamPreferencesScreenState();
}

class _TeamPreferencesScreenState extends State<TeamPreferencesScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  
  // Preferences
  String _preferredSport = 'Football';
  String _skillLevel = 'Intermediate';
  String _playStyle = 'Competitive';
  bool _notificationsEnabled = true;
  bool _autoJoinMatches = false;
  int _maxDistance = 10; // km
  List<String> _preferredVenues = [];
  
  final List<String> _sports = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton'];
  final List<String> _skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
  final List<String> _playStyles = ['Casual', 'Competitive', 'Mixed'];

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final profile = await FirestoreService.getUserProfile(user.uid);
      if (profile != null) {
        final prefs = profile['teamPreferences'] as Map<String, dynamic>? ?? {};
        setState(() {
          _preferredSport = prefs['preferredSport'] ?? 'Football';
          _skillLevel = prefs['skillLevel'] ?? 'Intermediate';
          _playStyle = prefs['playStyle'] ?? 'Competitive';
          _notificationsEnabled = prefs['notificationsEnabled'] ?? true;
          _autoJoinMatches = prefs['autoJoinMatches'] ?? false;
          _maxDistance = prefs['maxDistance'] ?? 10;
          _preferredVenues = List<String>.from(prefs['preferredVenues'] ?? []);
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading preferences: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _savePreferences() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    setState(() => _isSaving = true);

    try {
      await FirestoreService.updateUserProfile(user.uid, {
        'teamPreferences': {
          'preferredSport': _preferredSport,
          'skillLevel': _skillLevel,
          'playStyle': _playStyle,
          'notificationsEnabled': _notificationsEnabled,
          'autoJoinMatches': _autoJoinMatches,
          'maxDistance': _maxDistance,
          'preferredVenues': _preferredVenues,
          'updatedAt': DateTime.now().toIso8601String(),
        },
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Preferences saved successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save preferences: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surfaceDark,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.arrow_back, color: Colors.white),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Team Preferences',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _savePreferences,
            child: _isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                  )
                : const Text(
                    'SAVE',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionTitle('SPORT PREFERENCES'),
                  const SizedBox(height: 16),
                  _buildDropdown(
                    'Preferred Sport',
                    _preferredSport,
                    _sports,
                    (value) => setState(() => _preferredSport = value!),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('SKILL & STYLE'),
                  const SizedBox(height: 16),
                  _buildDropdown(
                    'Skill Level',
                    _skillLevel,
                    _skillLevels,
                    (value) => setState(() => _skillLevel = value!),
                  ),
                  const SizedBox(height: 16),
                  _buildDropdown(
                    'Play Style',
                    _playStyle,
                    _playStyles,
                    (value) => setState(() => _playStyle = value!),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('MATCH DISCOVERY'),
                  const SizedBox(height: 16),
                  _buildSlider(
                    'Maximum Distance',
                    '${_maxDistance} km',
                    _maxDistance.toDouble(),
                    1,
                    50,
                    (value) => setState(() => _maxDistance = value.toInt()),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('NOTIFICATIONS'),
                  const SizedBox(height: 16),
                  _buildSwitch(
                    'Team Notifications',
                    'Get notified about team activities',
                    _notificationsEnabled,
                    (value) => setState(() => _notificationsEnabled = value),
                  ),
                  const SizedBox(height: 16),
                  _buildSwitch(
                    'Auto-Join Matches',
                    'Automatically join matches based on preferences',
                    _autoJoinMatches,
                    (value) => setState(() => _autoJoinMatches = value),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        color: Colors.grey[500],
        fontSize: 10,
        fontWeight: FontWeight.w900,
        letterSpacing: 1.5,
      ),
    );
  }

  Widget _buildDropdown(
    String label,
    String value,
    List<String> items,
    ValueChanged<String?> onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.1),
        ),
      ),
      child: DropdownButton<String>(
        value: value,
        isExpanded: true,
        dropdownColor: AppColors.surfaceDark,
        style: const TextStyle(color: Colors.white),
        underline: const SizedBox(),
        items: items.map((item) {
          return DropdownMenuItem<String>(
            value: item,
            child: Text(item),
          );
        }).toList(),
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildSlider(
    String label,
    String value,
    double currentValue,
    double min,
    double max,
    ValueChanged<double> onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Slider(
            value: currentValue,
            min: min,
            max: max,
            activeColor: AppColors.primary,
            inactiveColor: Colors.grey[800],
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildSwitch(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.1),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}
