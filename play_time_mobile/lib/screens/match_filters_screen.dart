import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../theme/app_colors.dart';
import '../services/firestore_service.dart';

class MatchFiltersScreen extends StatefulWidget {
  const MatchFiltersScreen({super.key});

  @override
  State<MatchFiltersScreen> createState() => _MatchFiltersScreenState();
}

class _MatchFiltersScreenState extends State<MatchFiltersScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  
  // Filters
  List<String> _selectedSports = ['Football'];
  List<String> _selectedSkillLevels = ['Intermediate', 'Advanced'];
  String _matchType = 'Any'; // 'Any', 'Singles', 'Doubles'
  String _timePreference = 'Any'; // 'Any', 'Morning', 'Afternoon', 'Evening'
  int _maxDistance = 15; // km
  double _minPrice = 0;
  double _maxPrice = 5000;
  bool _showOnlyAvailable = true;
  
  final List<String> _sports = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton'];
  final List<String> _skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
  final List<String> _matchTypes = ['Any', 'Singles', 'Doubles'];
  final List<String> _timePreferences = ['Any', 'Morning (6-12)', 'Afternoon (12-6)', 'Evening (6-10)'];

  @override
  void initState() {
    super.initState();
    _loadFilters();
  }

  Future<void> _loadFilters() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final profile = await FirestoreService.getUserProfile(user.uid);
      if (profile != null) {
        final filters = profile['matchFilters'] as Map<String, dynamic>? ?? {};
        setState(() {
          _selectedSports = List<String>.from(filters['sports'] ?? ['Football']);
          _selectedSkillLevels = List<String>.from(filters['skillLevels'] ?? ['Intermediate', 'Advanced']);
          _matchType = filters['matchType'] ?? 'Any';
          _timePreference = filters['timePreference'] ?? 'Any';
          _maxDistance = filters['maxDistance'] ?? 15;
          _minPrice = (filters['minPrice'] ?? 0).toDouble();
          _maxPrice = (filters['maxPrice'] ?? 5000).toDouble();
          _showOnlyAvailable = filters['showOnlyAvailable'] ?? true;
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
            content: Text('Error loading filters: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _saveFilters() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    setState(() => _isSaving = true);

    try {
      await FirestoreService.updateUserProfile(user.uid, {
        'matchFilters': {
          'sports': _selectedSports,
          'skillLevels': _selectedSkillLevels,
          'matchType': _matchType,
          'timePreference': _timePreference,
          'maxDistance': _maxDistance,
          'minPrice': _minPrice,
          'maxPrice': _maxPrice,
          'showOnlyAvailable': _showOnlyAvailable,
          'updatedAt': DateTime.now().toIso8601String(),
        },
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Filters saved successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save filters: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }

  void _toggleSport(String sport) {
    setState(() {
      if (_selectedSports.contains(sport)) {
        _selectedSports.remove(sport);
      } else {
        _selectedSports.add(sport);
      }
    });
  }

  void _toggleSkillLevel(String level) {
    setState(() {
      if (_selectedSkillLevels.contains(level)) {
        _selectedSkillLevels.remove(level);
      } else {
        _selectedSkillLevels.add(level);
      }
    });
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
          'Match Filters',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _saveFilters,
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
                  _buildSectionTitle('SPORTS'),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: _sports.map((sport) {
                      final isSelected = _selectedSports.contains(sport);
                      return GestureDetector(
                        onTap: () => _toggleSport(sport),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary.withOpacity(0.2)
                                : AppColors.surfaceDark,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : Colors.white.withOpacity(0.1),
                            ),
                          ),
                          child: Text(
                            sport,
                            style: TextStyle(
                              color: isSelected ? AppColors.primary : Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('SKILL LEVELS'),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: _skillLevels.map((level) {
                      final isSelected = _selectedSkillLevels.contains(level);
                      return GestureDetector(
                        onTap: () => _toggleSkillLevel(level),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary.withOpacity(0.2)
                                : AppColors.surfaceDark,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : Colors.white.withOpacity(0.1),
                            ),
                          ),
                          child: Text(
                            level,
                            style: TextStyle(
                              color: isSelected ? AppColors.primary : Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('MATCH TYPE'),
                  const SizedBox(height: 16),
                  _buildDropdown(
                    'Match Type',
                    _matchType,
                    _matchTypes,
                    (value) => setState(() => _matchType = value!),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('TIME PREFERENCE'),
                  const SizedBox(height: 16),
                  _buildDropdown(
                    'Preferred Time',
                    _timePreference,
                    _timePreferences,
                    (value) => setState(() => _timePreference = value!),
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('DISTANCE'),
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
                  _buildSectionTitle('PRICE RANGE'),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildPriceField(
                          'Min',
                          _minPrice,
                          (value) => setState(() => _minPrice = value),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildPriceField(
                          'Max',
                          _maxPrice,
                          (value) => setState(() => _maxPrice = value),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _buildSectionTitle('OPTIONS'),
                  const SizedBox(height: 16),
                  _buildSwitch(
                    'Show Only Available',
                    'Only show matches with available slots',
                    _showOnlyAvailable,
                    (value) => setState(() => _showOnlyAvailable = value),
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

  Widget _buildPriceField(
    String label,
    double value,
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
          Text(
            label,
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            keyboardType: TextInputType.number,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              prefixText: '₹',
              prefixStyle: const TextStyle(
                color: AppColors.primary,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
              border: InputBorder.none,
              hintText: '0',
              hintStyle: TextStyle(color: Colors.grey[600]),
            ),
            controller: TextEditingController(text: value.toInt().toString())
              ..selection = TextSelection.collapsed(offset: value.toInt().toString().length),
            onChanged: (text) {
              final newValue = double.tryParse(text) ?? 0;
              onChanged(newValue);
            },
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
