import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'dart:io' show File;
import 'dart:typed_data';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../theme/app_colors.dart';
import '../widgets/bottom_nav.dart';
import '../providers/auth_provider.dart';
import '../providers/booking_provider.dart';
import '../providers/location_provider.dart';
import '../providers/membership_provider.dart';
import '../providers/language_provider.dart';
import '../providers/sport_provider.dart';
import '../models/booking.dart';
import '../services/storage_service.dart';
import '../services/firestore_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  XFile? _profileImage;
  Uint8List? _profileImageWebBytes;
  final ImagePicker _picker = ImagePicker();
  bool _isUploading = false;
  String? _uploadedImageUrl;
  double _walletBalance = 0.0;
  bool _isEditMode = false;
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  Map<String, dynamic>? _userProfileData;
  int _totalBookings = 0;
  int _totalTeams = 0;
  int _winRate = 0;
  bool _isLoadingStats = true;
  int _totalMatches = 0;
  int _matchesWon = 0;
  int _totalSpent = 0;
  int _currentStreak = 0;
  int _longestStreak = 0;
  List<Map<String, dynamic>> _achievements = [];
  Map<String, int> _sportStats = {};

  @override
  void initState() {
    super.initState();
    _loadUserProfileImage();
    _loadUserProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadUserProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      if (mounted) setState(() => _isLoadingStats = true);
      try {
        final profile = await FirestoreService.getUserProfile(user.uid);
        final bookings = await FirestoreService.getUserBookings(user.uid);
        final teams = await FirestoreService.getUserTeams(user.uid);

        // Calculate detailed statistics
        final completedBookings = bookings
            .where((b) => b.status == BookingStatus.completed)
            .toList();
        // Booking completion rate (not win rate — win tracking requires match results)
        final completionRate = bookings.isNotEmpty
            ? ((completedBookings.length / bookings.length) * 100).round()
            : 0;

        // Calculate sport statistics (normalize IDs → display names)
        if (!mounted) return;
        final sportProvider = Provider.of<SportProvider>(
          context,
          listen: false,
        );
        final sportCounts = <String, int>{};
        for (var booking in bookings) {
          final label = _sportLabelForBooking(booking, sportProvider);
          if (label.isEmpty) continue;
          sportCounts[label] = (sportCounts[label] ?? 0) + 1;
        }
        // Calculate total spent
        final totalSpent = bookings.fold<double>(0, (sum, b) => sum + b.amount);

        // Get additional stats from profile
        final streak = profile?['streak'] ?? 0;
        final longestStreak = profile?['longestStreak'] ?? 0;
        final achievements = profile?['achievements'] as List<dynamic>? ?? [];

        setState(() {
          _walletBalance = (profile?['walletBalance'] ?? 0.0).toDouble();
          _userProfileData = profile;
          _nameController.text = profile?['name'] ?? user.displayName ?? '';
          _emailController.text = user.email ?? '';
          _phoneController.text = profile?['phone'] ?? user.phoneNumber ?? '';
          _totalBookings = bookings.length;
          _totalTeams = teams.length;
          _winRate = completionRate;
          _totalMatches = completedBookings.length;
          final rawMatchesWon = profile?['matchesWon'];
          _matchesWon = rawMatchesWon is int
              ? rawMatchesWon
              : (rawMatchesWon is num ? rawMatchesWon.toInt() : 0);
          _totalSpent = totalSpent.toInt();
          _currentStreak = streak is int
              ? streak
              : (streak is num ? streak.toInt() : 0);
          _longestStreak = longestStreak is int
              ? longestStreak
              : (longestStreak is num ? longestStreak.toInt() : 0);
          _sportStats = sportCounts;
          _achievements = achievements
              .map(
                (a) => a is Map
                    ? Map<String, dynamic>.from(a)
                    : {'name': a.toString(), 'unlocked': true},
              )
              .toList();
          _isLoadingStats = false;
        });
      } catch (e) {
        debugPrint('Error loading profile: $e');
        if (mounted) {
          setState(() => _isLoadingStats = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to load profile data. Pull down to retry.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }
  }

  Future<void> _saveProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      setState(() => _isUploading = true);

      // Update display name in Firebase Auth
      if (_nameController.text.trim().isNotEmpty) {
        await user.updateDisplayName(_nameController.text.trim());
        await user.reload();
      }

      // Update Firestore profile
      final updates = <String, dynamic>{
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'updatedAt': DateTime.now().toIso8601String(),
      };

      await FirestoreService.updateUserProfile(user.uid, updates);

      setState(() {
        _isEditMode = false;
        _isUploading = false;
      });

      // Reload profile data
      await _loadUserProfile();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      setState(() => _isUploading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _showNotificationSettings(BuildContext context) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    // Load current notification preferences
    final profile = await FirestoreService.getUserProfile(user.uid);
    final notificationSettings =
        profile?['notificationSettings'] as Map<String, dynamic>? ?? {};
    if (!context.mounted) return;

    bool bookingNotifications = notificationSettings['booking'] ?? true;
    bool matchNotifications = notificationSettings['match'] ?? true;
    bool socialNotifications = notificationSettings['social'] ?? true;
    bool promotionalNotifications =
        notificationSettings['promotional'] ?? false;

    await showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'NOTIFICATION SETTINGS',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.25,
                ),
              ),
              const SizedBox(height: 24),
              _buildNotificationToggle(
                context: context,
                title: 'Booking Notifications',
                subtitle:
                    'Get notified about booking confirmations and updates',
                value: bookingNotifications,
                onChanged: (value) {
                  setModalState(() => bookingNotifications = value);
                },
              ),
              const SizedBox(height: 16),
              _buildNotificationToggle(
                context: context,
                title: 'Match Notifications',
                subtitle: 'Updates about matches and tournaments',
                value: matchNotifications,
                onChanged: (value) {
                  setModalState(() => matchNotifications = value);
                },
              ),
              const SizedBox(height: 16),
              _buildNotificationToggle(
                context: context,
                title: 'Social Notifications',
                subtitle: 'Likes, comments, and social feed updates',
                value: socialNotifications,
                onChanged: (value) {
                  setModalState(() => socialNotifications = value);
                },
              ),
              const SizedBox(height: 16),
              _buildNotificationToggle(
                context: context,
                title: 'Promotional Notifications',
                subtitle: 'Deals, offers, and promotional content',
                value: promotionalNotifications,
                onChanged: (value) {
                  setModalState(() => promotionalNotifications = value);
                },
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'CANCEL',
                        style: TextStyle(
                          color: Colors.grey,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () async {
                        try {
                          await FirestoreService.updateUserProfile(user.uid, {
                            'notificationSettings': {
                              'booking': bookingNotifications,
                              'match': matchNotifications,
                              'social': socialNotifications,
                              'promotional': promotionalNotifications,
                            },
                          });
                          if (context.mounted) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Notification settings saved!'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Failed to save settings: $e'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.backgroundDark,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'SAVE SETTINGS',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationToggle({
    required BuildContext context,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
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
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    height: 1.25,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Future<void> _showWalletTopUpDialog(BuildContext context) async {
    final amountController = TextEditingController();
    final selectedAmount = ValueNotifier<double?>(null);

    await showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceDark,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'ADD MONEY TO WALLET',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.25,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'QUICK AMOUNT',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.25,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [100, 250, 500, 1000, 2000, 5000].map((amount) {
                  final isSelected = selectedAmount.value == amount.toDouble();
                  return GestureDetector(
                    onTap: () {
                      setModalState(() {
                        selectedAmount.value = amount.toDouble();
                        amountController.text = amount.toString();
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary.withValues(alpha: 0.2)
                            : AppColors.backgroundDark,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                      child: Text(
                        '₹$amount',
                        style: TextStyle(
                          color: isSelected ? AppColors.primary : Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              const Text(
                'OR ENTER CUSTOM AMOUNT',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.25,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Enter amount',
                  hintStyle: TextStyle(color: Colors.grey[600]),
                  prefixText: '₹',
                  prefixStyle: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                  filled: true,
                  fillColor: AppColors.backgroundDark,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(
                      color: Colors.white.withValues(alpha: 0.1),
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(
                      color: Colors.white.withValues(alpha: 0.1),
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(
                      color: AppColors.primary,
                      width: 2,
                    ),
                  ),
                ),
                onChanged: (value) {
                  setModalState(() {
                    selectedAmount.value = null;
                  });
                },
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'CANCEL',
                        style: TextStyle(
                          color: Colors.grey,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () async {
                        final amountText = amountController.text.trim();
                        if (amountText.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please enter an amount'),
                              backgroundColor: AppColors.error,
                            ),
                          );
                          return;
                        }

                        final amount = double.tryParse(amountText);
                        if (amount == null || amount <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please enter a valid amount'),
                              backgroundColor: AppColors.error,
                            ),
                          );
                          return;
                        }

                        Navigator.pop(context);
                        await _addMoneyToWallet(amount);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.backgroundDark,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'ADD MONEY',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );

    amountController.dispose();
  }

  Future<void> _addMoneyToWallet(double amount) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      setState(() => _isUploading = true);

      // Get current wallet balance
      final profile = await FirestoreService.getUserProfile(user.uid);
      final currentBalance = (profile?['walletBalance'] ?? 0.0).toDouble();
      final newBalance = currentBalance + amount;

      // Update wallet balance
      await FirestoreService.updateUserProfile(user.uid, {
        'walletBalance': newBalance,
      });

      // Create wallet transaction record
      await FirestoreService.createWalletTransaction(
        userId: user.uid,
        type: 'Credit',
        amount: amount,
        description: 'Wallet top-up',
        balanceAfter: newBalance,
      );

      setState(() {
        _walletBalance = newBalance;
        _isUploading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('₹${amount.toInt()} added to wallet successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      setState(() => _isUploading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add money: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _loadUserProfileImage() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user?.photoURL != null) {
      setState(() {
        _uploadedImageUrl = user!.photoURL;
      });
    } else if (user != null) {
      // Try to get from Firestore user profile
      try {
        final userProfile = await FirestoreService.getUserProfile(user.uid);
        if (userProfile != null && userProfile['photoURL'] != null) {
          if (mounted) {
            setState(() {
              _uploadedImageUrl = userProfile['photoURL'] as String;
            });
          }
        }
      } catch (e) {
        debugPrint('Error loading user profile image: $e');
      }
    }
  }

  Future<void> _pickImage() async {
    try {
      // Show options: Camera or Gallery
      final source = await showModalBottomSheet<ImageSource>(
        context: context,
        backgroundColor: AppColors.surfaceDark,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (context) => Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppColors.primary),
                title: const Text(
                  'Take Photo',
                  style: TextStyle(color: Colors.white),
                ),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(
                  Icons.photo_library,
                  color: AppColors.primary,
                ),
                title: const Text(
                  'Choose from Gallery',
                  style: TextStyle(color: Colors.white),
                ),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      );

      if (source == null) return;

      final XFile? image = await _picker.pickImage(
        source: source,
        imageQuality: 80,
        maxWidth: 1024,
        maxHeight: 1024,
      );

      if (image != null) {
        Uint8List? webBytes;
        if (kIsWeb) {
          webBytes = await image.readAsBytes();
        }
        setState(() {
          _profileImage = image;
          _profileImageWebBytes = webBytes;
          _isUploading = true;
        });

        await _uploadImage(image);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error picking image: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      setState(() {
        _isUploading = false;
      });
    }
  }

  Future<void> _uploadImage(XFile imageFile) async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Upload to Firebase Storage
      final imageUrl = await StorageService.uploadProfileImage(
        imageFile,
        user.uid,
      );

      // Update Firebase Auth profile
      await user.updatePhotoURL(imageUrl);
      await user.reload();

      // Update Firestore user profile
      await FirestoreService.updateUserProfile(user.uid, {
        'photoURL': imageUrl,
        'updatedAt': DateTime.now().toIso8601String(),
      });

      setState(() {
        _uploadedImageUrl = imageUrl;
        _isUploading = false;
        _profileImageWebBytes = null;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile image updated successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to upload image: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      setState(() {
        _isUploading = false;
        _profileImage = null;
        _profileImageWebBytes = null;
      });
    }
  }

  Widget _buildDefaultAvatar() {
    final user = FirebaseAuth.instance.currentUser;
    final initial = user?.displayName?.isNotEmpty == true
        ? user!.displayName![0].toUpperCase()
        : user?.email?.isNotEmpty == true
        ? user!.email![0].toUpperCase()
        : 'U';

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
        ),
      ),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 48,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }

  String _getStatusIcon(BookingStatus status) {
    switch (status) {
      case BookingStatus.pending:
        return 'schedule';
      case BookingStatus.confirmed:
        return 'schedule';
      case BookingStatus.completed:
        return 'check_circle';
      case BookingStatus.cancelled:
        return 'cancel';
    }
  }

  Color _getStatusColor(BookingStatus status) {
    switch (status) {
      case BookingStatus.pending:
        return Colors.orange;
      case BookingStatus.confirmed:
        return AppColors.primary;
      case BookingStatus.completed:
        return Colors.green;
      case BookingStatus.cancelled:
        return Colors.red;
    }
  }

  Future<void> _confirmSignOut(AuthProvider authProvider) async {
    final shouldSignOut = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surfaceDark,
        title: const Text('Log out?'),
        content: const Text(
          'You will need to sign in again to manage bookings and teams.',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (shouldSignOut != true || !mounted) return;
    await authProvider.signOut();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final bookingProvider = Provider.of<BookingProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final membershipProvider = Provider.of<MembershipProvider>(context);
    final languageProvider = Provider.of<LanguageProvider>(context);
    final isProMember = membershipProvider.hasActiveMembership(null);
    final bookings = bookingProvider.bookings;
    final latestUpcoming = bookingProvider.getLatestUpcomingBooking();

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          if (Navigator.canPop(context)) {
            context.pop();
          } else {
            context.go('/home');
          }
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: SafeArea(
          child: Column(
            children: [
              // Header
              Container(
                height: 64,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.backgroundDark.withValues(alpha: 0.95),
                  border: Border(
                    bottom: BorderSide(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Back',
                      icon: const Icon(Icons.arrow_back_rounded),
                      onPressed: () {
                        if (Navigator.canPop(context)) {
                          Navigator.pop(context);
                        } else {
                          context.go('/home');
                        }
                      },
                    ),
                    Expanded(
                      child: Text(
                        languageProvider.translate('profile_title'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        if (_isEditMode) {
                          _saveProfile();
                        } else {
                          setState(() {
                            _isEditMode = true;
                          });
                        }
                      },
                      child: Text(
                        _isEditMode
                            ? languageProvider.translate('save')
                            : languageProvider.translate('edit'),
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Content
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    await Future.wait([
                      _loadUserProfile(),
                      bookingProvider.pullToRefresh(),
                    ]);
                  },
                  color: AppColors.primary,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      children: [
                        const SizedBox(height: 24),
                        // Profile Image
                        Stack(
                          children: [
                            Container(
                              width: 112,
                              height: 112,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [AppColors.primary, Colors.blue],
                                ),
                                border: Border.all(
                                  color: AppColors.backgroundDark,
                                  width: 4,
                                ),
                              ),
                              child: ClipOval(
                                child: _isUploading
                                    ? const Center(
                                        child: CircularProgressIndicator(
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(
                                                AppColors.primary,
                                              ),
                                        ),
                                      )
                                    : _profileImage != null
                                    ? kIsWeb && _profileImageWebBytes != null
                                          ? Image.memory(
                                              _profileImageWebBytes!,
                                              fit: BoxFit.cover,
                                            )
                                          : !kIsWeb
                                          ? Image.file(
                                              File(_profileImage!.path),
                                              fit: BoxFit.cover,
                                            )
                                          : const SizedBox.shrink()
                                    : _uploadedImageUrl != null
                                    ? Image.network(
                                        _uploadedImageUrl!,
                                        fit: BoxFit.cover,
                                        errorBuilder:
                                            (context, error, stackTrace) {
                                              return _buildDefaultAvatar();
                                            },
                                      )
                                    : _buildDefaultAvatar(),
                              ),
                            ),
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: GestureDetector(
                                onTap: _pickImage,
                                child: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: AppColors.backgroundDark,
                                      width: 4,
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.photo_camera,
                                    color: AppColors.backgroundDark,
                                    size: 18,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        // User Info
                        _isEditMode
                            ? Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 24,
                                ),
                                child: Column(
                                  children: [
                                    TextField(
                                      controller: _nameController,
                                      style: const TextStyle(
                                        color: Colors.white,
                                      ),
                                      decoration: InputDecoration(
                                        labelText: languageProvider.translate(
                                          'name',
                                        ),
                                        labelStyle: TextStyle(
                                          color: Colors.grey[400],
                                        ),
                                        filled: true,
                                        fillColor: AppColors.backgroundDark,
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: BorderSide(
                                            color: Colors.white.withValues(
                                              alpha: 0.1,
                                            ),
                                          ),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: BorderSide(
                                            color: Colors.white.withValues(
                                              alpha: 0.1,
                                            ),
                                          ),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: const BorderSide(
                                            color: AppColors.primary,
                                            width: 2,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    TextField(
                                      controller: _emailController,
                                      enabled: false,
                                      style: TextStyle(color: Colors.grey[600]),
                                      decoration: InputDecoration(
                                        labelText: languageProvider.translate(
                                          'email',
                                        ),
                                        labelStyle: TextStyle(
                                          color: Colors.grey[400],
                                        ),
                                        filled: true,
                                        fillColor: AppColors.backgroundDark,
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: BorderSide(
                                            color: Colors.white.withValues(
                                              alpha: 0.1,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    TextField(
                                      controller: _phoneController,
                                      keyboardType: TextInputType.phone,
                                      style: const TextStyle(
                                        color: Colors.white,
                                      ),
                                      decoration: InputDecoration(
                                        labelText: languageProvider.translate(
                                          'phone',
                                        ),
                                        labelStyle: TextStyle(
                                          color: Colors.grey[400],
                                        ),
                                        filled: true,
                                        fillColor: AppColors.backgroundDark,
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: BorderSide(
                                            color: Colors.white.withValues(
                                              alpha: 0.1,
                                            ),
                                          ),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: BorderSide(
                                            color: Colors.white.withValues(
                                              alpha: 0.1,
                                            ),
                                          ),
                                        ),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          borderSide: const BorderSide(
                                            color: AppColors.primary,
                                            width: 2,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            : Builder(
                                builder: (context) {
                                  final user =
                                      FirebaseAuth.instance.currentUser;
                                  final displayName =
                                      user?.displayName ??
                                      _userProfileData?['name'] ??
                                      user?.email?.split('@').first ??
                                      'User';
                                  return Text(
                                    displayName,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  );
                                },
                              ),
                        const SizedBox(height: 8),
                        GestureDetector(
                          onTap: () async {
                            // Open map view to select location
                            await context.push('/map-view?select=true');
                            // Refresh location after returning
                            if (!context.mounted) return;
                            final locationProvider =
                                Provider.of<LocationProvider>(
                                  context,
                                  listen: false,
                                );
                            await locationProvider.refreshLocation();
                          },
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.location_on,
                                color: AppColors.primary,
                                size: 18,
                              ),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Consumer<LocationProvider>(
                                  builder: (context, locationProvider, child) {
                                    return Text(
                                      locationProvider.displayLocation,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.2,
                                      ),
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.edit,
                                color: AppColors.primary,
                                size: 14,
                              ),
                            ],
                          ),
                        ),
                        if (isProMember) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.primary.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              languageProvider.translate('pro_member'),
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.35,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 28),
                        if (latestUpcoming != null) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const _ProfileSectionTitle(
                                  title: 'Coming up next',
                                  icon: Icons.bolt_rounded,
                                ),
                                const SizedBox(height: 12),
                                _buildNextActiveMatchCard(latestUpcoming),
                              ],
                            ),
                          ),
                          const SizedBox(height: 28),
                        ],
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const _ProfileSectionTitle(
                                title: 'Your activity',
                                icon: Icons.insights_rounded,
                              ),
                              const SizedBox(height: 12),
                              Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () => _showWalletTopUpDialog(context),
                                  borderRadius: BorderRadius.circular(20),
                                  child: Ink(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [
                                          AppColors.primary.withValues(
                                            alpha: 0.18,
                                          ),
                                          AppColors.surfaceDark,
                                        ],
                                      ),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: AppColors.primary.withValues(
                                          alpha: 0.24,
                                        ),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 44,
                                          height: 44,
                                          decoration: BoxDecoration(
                                            color: AppColors.primary.withValues(
                                              alpha: 0.14,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              14,
                                            ),
                                          ),
                                          child: const Icon(
                                            Icons
                                                .account_balance_wallet_rounded,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                languageProvider.translate(
                                                  'wallet',
                                                ),
                                                style: const TextStyle(
                                                  color:
                                                      AppColors.textSecondary,
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                              const SizedBox(height: 3),
                                              Text(
                                                '₹${_walletBalance.toInt()}',
                                                style: const TextStyle(
                                                  color: AppColors.textPrimary,
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.w900,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const Text(
                                          'Add money',
                                          style: TextStyle(
                                            color: AppColors.primary,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const Icon(
                                          Icons.arrow_forward_rounded,
                                          color: AppColors.primary,
                                          size: 18,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              if (_isLoadingStats)
                                const SizedBox(
                                  height: 120,
                                  child: Center(
                                    child: CircularProgressIndicator(
                                      color: AppColors.primary,
                                    ),
                                  ),
                                )
                              else
                                SizedBox(
                                  height: 126,
                                  child: ListView(
                                    clipBehavior: Clip.none,
                                    scrollDirection: Axis.horizontal,
                                    children: [
                                      _profileMetric(
                                        value: '$_totalBookings',
                                        label: languageProvider.translate(
                                          'bookings',
                                        ),
                                        icon: Icons.calendar_month_rounded,
                                        color: AppColors.primary,
                                      ),
                                      _profileMetric(
                                        value: '$_totalMatches',
                                        label: languageProvider.translate(
                                          'matches',
                                        ),
                                        icon: Icons.sports_rounded,
                                        color: AppColors.cyan,
                                      ),
                                      _profileMetric(
                                        value: '$_totalTeams',
                                        label: languageProvider.translate(
                                          'teams',
                                        ),
                                        icon: Icons.groups_rounded,
                                        color: AppColors.info,
                                      ),
                                      _profileMetric(
                                        value: '$_currentStreak',
                                        label: languageProvider.translate(
                                          'streak',
                                        ),
                                        icon: Icons.local_fire_department,
                                        color: AppColors.orange,
                                      ),
                                      _profileMetric(
                                        value: '$_winRate%',
                                        label: 'Completion',
                                        icon: Icons.emoji_events_rounded,
                                        color: AppColors.warning,
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        // Achievements Section
                        if (_achievements.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  languageProvider.translate('achievements'),
                                  style: TextStyle(
                                    color: Colors.grey,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.35,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: _achievements.take(6).map((
                                    achievement,
                                  ) {
                                    return Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceDark,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: AppColors.primary.withValues(
                                            alpha: 0.3,
                                          ),
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(
                                            Icons.emoji_events,
                                            color: AppColors.primary,
                                            size: 20,
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            achievement['name'] ??
                                                'Achievement',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 32),
                        ],
                        // Detailed Stats Section
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                languageProvider.translate('player_statistics'),
                                style: TextStyle(
                                  color: Colors.grey,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.35,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceDark,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.05),
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    _buildStatRow(
                                      languageProvider.translate(
                                        'stat_total_bookings',
                                      ),
                                      '$_totalBookings',
                                    ),
                                    const Divider(
                                      color: Colors.white24,
                                      height: 24,
                                    ),
                                    _buildStatRow(
                                      languageProvider.translate(
                                        'stat_matches_played',
                                      ),
                                      '$_totalMatches',
                                    ),
                                    const Divider(
                                      color: Colors.white24,
                                      height: 24,
                                    ),
                                    _buildStatRow(
                                      languageProvider.translate(
                                        'stat_matches_won',
                                      ),
                                      '$_matchesWon',
                                    ),
                                    const Divider(
                                      color: Colors.white24,
                                      height: 24,
                                    ),
                                    _buildStatRow(
                                      'Booking completion',
                                      '$_winRate%',
                                    ),
                                    const Divider(
                                      color: Colors.white24,
                                      height: 24,
                                    ),
                                    _buildStatRow(
                                      languageProvider.translate(
                                        'stat_total_spent',
                                      ),
                                      '₹$_totalSpent',
                                    ),
                                    const Divider(
                                      color: Colors.white24,
                                      height: 24,
                                    ),
                                    _buildStatRow(
                                      languageProvider.translate(
                                        'stat_current_streak',
                                      ),
                                      '$_currentStreak ${languageProvider.translate('days')}',
                                    ),
                                    const Divider(
                                      color: Colors.white24,
                                      height: 24,
                                    ),
                                    _buildStatRow(
                                      languageProvider.translate(
                                        'stat_longest_streak',
                                      ),
                                      '$_longestStreak ${languageProvider.translate('days')}',
                                    ),
                                    if (_sportStats.isNotEmpty) ...[
                                      const Divider(
                                        color: Colors.white24,
                                        height: 24,
                                      ),
                                      Text(
                                        languageProvider.translate(
                                          'sport_breakdown',
                                        ),
                                        style: const TextStyle(
                                          color: Colors.grey,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.25,
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      ..._sportStats.entries.map(
                                        (entry) => Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 8,
                                          ),
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                entry.key,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                              Text(
                                                '${entry.value} ${languageProvider.translate('games')}',
                                                style: TextStyle(
                                                  color: AppColors.primary,
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w900,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                        // Settings Section
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                languageProvider.translate('settings'),
                                style: TextStyle(
                                  color: Colors.grey[500],
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.35,
                                ),
                              ),
                              const SizedBox(height: 16),
                              _buildSettingsItem(
                                icon: Icons.notifications_outlined,
                                title: languageProvider.translate(
                                  'notifications',
                                ),
                                subtitle: languageProvider.translate(
                                  'manage_notifications',
                                ),
                                onTap: () => _showNotificationSettings(context),
                              ),
                              const SizedBox(height: 12),
                              _buildSettingsItem(
                                icon: Icons.lock_outline,
                                title: languageProvider.translate(
                                  'privacy_security',
                                ),
                                subtitle: languageProvider.translate(
                                  'manage_privacy',
                                ),
                                onTap: () {
                                  context.push('/privacy-settings');
                                },
                              ),
                              const SizedBox(height: 12),
                              _buildSettingsItem(
                                icon: Icons.language,
                                title: languageProvider.translate('language'),
                                subtitle:
                                    languageProvider
                                            .currentLocale
                                            .languageCode ==
                                        'en'
                                    ? 'English'
                                    : languageProvider
                                              .currentLocale
                                              .languageCode ==
                                          'hi'
                                    ? 'Hindi'
                                    : languageProvider
                                              .currentLocale
                                              .languageCode ==
                                          'ta'
                                    ? 'Tamil'
                                    : languageProvider
                                              .currentLocale
                                              .languageCode ==
                                          'te'
                                    ? 'Telugu'
                                    : languageProvider
                                              .currentLocale
                                              .languageCode ==
                                          'kn'
                                    ? 'Kannada'
                                    : languageProvider
                                              .currentLocale
                                              .languageCode ==
                                          'ml'
                                    ? 'Malayalam'
                                    : languageProvider
                                          .currentLocale
                                          .languageCode
                                          .toUpperCase(),
                                onTap: () {
                                  context.push('/language-settings');
                                },
                              ),
                              const SizedBox(height: 12),
                              _buildSettingsItem(
                                icon: Icons.help_outline,
                                title: languageProvider.translate(
                                  'help_support',
                                ),
                                subtitle: languageProvider.translate(
                                  'get_help',
                                ),
                                onTap: () {
                                  context.push('/help-support');
                                },
                              ),
                              const SizedBox(height: 12),
                              _buildSettingsItem(
                                icon: Icons.info_outline,
                                title: languageProvider.translate('about'),
                                subtitle: languageProvider.translate(
                                  'app_version',
                                ),
                                onTap: () {
                                  showDialog(
                                    context: context,
                                    builder: (context) => AlertDialog(
                                      backgroundColor: AppColors.surfaceDark,
                                      title: const Text(
                                        'About Play Time',
                                        style: TextStyle(color: Colors.white),
                                      ),
                                      content: const Text(
                                        'Play Time v1.0.0\n\nYour ultimate sports venue booking app.',
                                        style: TextStyle(color: Colors.grey),
                                      ),
                                      actions: [
                                        TextButton(
                                          onPressed: () =>
                                              Navigator.pop(context),
                                          child: const Text(
                                            'OK',
                                            style: TextStyle(
                                              color: AppColors.primary,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                        // Booking History
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    languageProvider.translate(
                                      'booking_history',
                                    ),
                                    style: TextStyle(
                                      color: Colors.grey[500],
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.35,
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => context.push('/bookings'),
                                    child: Text(
                                      'View all (${bookings.length})',
                                      style: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (bookings.isEmpty)
                                Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(40),
                                    child: Text(
                                      languageProvider.translate('no_bookings'),
                                      style: TextStyle(
                                        color: Colors.grey[600],
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                )
                              else
                                ...bookings
                                    .take(3)
                                    .map(
                                      (booking) => _buildBookingCard(
                                        booking,
                                        bookingProvider,
                                      ),
                                    ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                        // Logout Button
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: () => _confirmSignOut(authProvider),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(
                                  color: Colors.red,
                                  width: 1,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 20,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.logout, color: Colors.red),
                                  const SizedBox(width: 12),
                                  const Text(
                                    'LOG OUT',
                                    style: TextStyle(
                                      color: Colors.red,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.25,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const BottomNav(currentIndex: 3),
      ),
    );
  }

  Widget _buildBookingCard(Booking booking, BookingProvider provider) {
    final statusColor = _getStatusColor(booking.status);
    final statusIcon = _getStatusIcon(booking.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        children: [
          if (booking.venueImage != null)
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
              child: Image.network(
                booking.venueImage!,
                height: 96,
                width: double.infinity,
                fit: BoxFit.cover,
                color: Colors.black.withValues(alpha: 0.4),
                colorBlendMode: BlendMode.darken,
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            booking.venueName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            booking.sport.toUpperCase(),
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            statusIcon == 'schedule'
                                ? Icons.schedule
                                : statusIcon == 'check_circle'
                                ? Icons.check_circle
                                : Icons.cancel,
                            color: statusColor,
                            size: 14,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            booking.status.toString().toUpperCase(),
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.25,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Icon(Icons.event, color: Colors.grey[400], size: 18),
                    const SizedBox(width: 8),
                    Text(
                      booking.date,
                      style: TextStyle(color: Colors.grey[400], fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.schedule, color: Colors.grey[400], size: 18),
                    const SizedBox(width: 8),
                    Text(
                      booking.time,
                      style: TextStyle(color: Colors.grey[400], fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'PAID',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.25,
                          ),
                        ),
                        Text(
                          '₹${booking.amount.toInt()}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    if (booking.status.isUpcoming)
                      OutlinedButton(
                        onPressed: () {
                          showDialog(
                            context: context,
                            builder: (context) => AlertDialog(
                              backgroundColor: AppColors.surfaceDark,
                              title: const Text(
                                'Cancel Booking?',
                                style: TextStyle(color: Colors.white),
                              ),
                              content: const Text(
                                'Are you sure you want to cancel this booking?',
                                style: TextStyle(color: Colors.grey),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('No'),
                                ),
                                TextButton(
                                  onPressed: () {
                                    provider.cancelBooking(booking.id);
                                    Navigator.pop(context);
                                  },
                                  child: const Text(
                                    'Yes',
                                    style: TextStyle(color: Colors.red),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.red),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'CANCEL',
                          style: TextStyle(
                            color: Colors.red,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.25,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNextActiveMatchCard(Booking booking) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.venueName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        booking.sport.toUpperCase(),
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.1),
                  ),
                ),
                child: Icon(
                  booking.sport == 'Football'
                      ? Icons.sports_soccer
                      : booking.sport == 'Cricket'
                      ? Icons.sports_cricket
                      : Icons.sports_tennis,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SCHEDULED DATE',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        booking.date,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'GAME TIME',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.25,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        booking.time,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: Semantics(
              label: 'View pass',
              button: true,
              child: ElevatedButton(
                onPressed: () {
                  context.push('/booking-pass?id=${booking.id}');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.backgroundDark,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'VIEW PASS',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.25,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.qr_code_2, size: 20),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// True when [value] looks like a Firestore auto-id, not a sport name.
  static bool _looksLikeFirestoreId(String value) {
    final compact = value.replaceAll(RegExp(r'\s+'), '');
    return compact.length >= 12 && RegExp(r'^[a-zA-Z0-9]+$').hasMatch(compact);
  }

  String _sportLabelForBooking(Booking booking, SportProvider sportProvider) {
    final raw = booking.sport.trim();
    if (raw.isEmpty) {
      return '';
    }

    if (!_looksLikeFirestoreId(raw)) {
      return _titleCaseSport(raw);
    }

    final compactId = raw.replaceAll(RegExp(r'\s+'), '');
    final byId = sportProvider.getSportById(compactId);
    if (byId != null) return byId.name;

    // Legacy bookings may have stored courtId in sport — show court name if present
    final court = booking.courtName?.trim();
    if (court != null && court.isNotEmpty && !_looksLikeFirestoreId(court)) {
      return court;
    }

    return '';
  }

  String _titleCaseSport(String name) {
    if (name.isEmpty) return name;
    return name
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
        .join(' ');
  }

  Widget _profileMetric({
    required String value,
    required String label,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      width: 122,
      margin: const EdgeInsets.only(right: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const Spacer(),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.grey[400],
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }

  Widget _buildSettingsItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      label: '$title. $subtitle',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceDark,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderMedium),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(icon, color: AppColors.primary, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textTertiary,
                  size: 22,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileSectionTitle extends StatelessWidget {
  final String title;
  final IconData icon;

  const _ProfileSectionTitle({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 18),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }
}
