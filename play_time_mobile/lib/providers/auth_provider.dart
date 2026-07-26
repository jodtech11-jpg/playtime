import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/firebase_service.dart';
import '../services/notification_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  String? _userRole;
  bool _isLoading = false;
  String? _error;
  String? _verificationId;
  int? _resendToken;
  bool _disposed = false;
  StreamSubscription<User?>? _authSubscription;

  User? get user => _user;
  String? get userRole => _userRole;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;
  String? get verificationId => _verificationId;

  AuthProvider() {
    _init();
  }

  void _init() {
    _authSubscription = FirebaseService.authStateChanges.listen((
      User? user,
    ) async {
      _user = user;
      if (user != null) {
        await _fetchUserRole(user.uid);
      } else {
        _userRole = null;
      }
      if (!_disposed) notifyListeners();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _authSubscription?.cancel();
    super.dispose();
  }

  Future<void> _fetchUserRole(String userId) async {
    try {
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .get();
      if (userDoc.exists) {
        final role = userDoc.data()?['role'] as String? ?? 'player';
        if (role == 'venue_manager' || role == 'super_admin') {
          _error =
              'This account is registered as a Vendor. Please use the Admin Panel.';
          await FirebaseService.signOut();
          _user = null;
          _userRole = null;
          if (!_disposed) notifyListeners();
          return;
        }
        _userRole = role;
      } else {
        _userRole = 'player';
      }
    } catch (e) {
      debugPrint('Error fetching user role: $e');
      _userRole = 'player';
      if (!_disposed) notifyListeners();
    }
  }

  Future<bool> signInWithGoogle() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final webClientId = const String.fromEnvironment(
        'GOOGLE_WEB_CLIENT_ID',
        defaultValue:
            '721347779964-39oif0m5cj2hacg6nodn00aorn556sn4.apps.googleusercontent.com',
      );
      final GoogleSignIn googleSignIn = GoogleSignIn(
        clientId: kIsWeb ? webClientId : null,
      );

      // Try silent sign-in first (recommended for web)
      GoogleSignInAccount? googleUser = await googleSignIn.signInSilently();

      // If silent sign-in fails, trigger the regular sign-in flow
      googleUser ??= await googleSignIn.signIn();

      if (googleUser == null) {
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final userCredential = await FirebaseService.auth.signInWithCredential(
        credential,
      );
      _user = userCredential.user;

      // Create or update user profile in Firestore
      if (_user != null) {
        await _createOrUpdateUserProfile(_user!);
        if (_error != null || _user == null) {
          _isLoading = false;
          notifyListeners();
          return false;
        }
        // Save FCM token after successful authentication
        await NotificationService.saveTokenAfterAuth();
      }

      _isLoading = false;
      notifyListeners();
      return _user != null;
    } catch (e) {
      debugPrint('Google sign-in error: $e');
      final errorMsg = e.toString();
      if (errorMsg.contains('People API') ||
          errorMsg.contains('PERMISSION_DENIED')) {
        _error = 'Configuration error. Please contact support.';
      } else if (errorMsg.contains('network') || errorMsg.contains('Network')) {
        _error = 'Network error. Please check your connection and try again.';
      } else {
        _error = 'Sign-in failed. Please try again.';
      }
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signInWithPhone(String phoneNumber) async {
    try {
      _isLoading = true;
      _error = null;
      _verificationId = null;
      _resendToken = null;
      notifyListeners();

      // Validate phone number format
      if (!phoneNumber.startsWith('+')) {
        _error = 'Phone number must include country code (e.g., +91...)';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      debugPrint('Attempting to verify phone number: $phoneNumber');

      // Use Completer to wait for codeSent callback
      final completer = Completer<bool>();
      bool hasCompleted = false;

      await FirebaseService.auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) async {
          if (hasCompleted) return;
          hasCompleted = true;
          debugPrint('Auto-verification completed');
          try {
            await FirebaseService.auth.signInWithCredential(credential);
            _user = FirebaseService.auth.currentUser;
            if (_user != null) {
              await _createOrUpdateUserProfile(_user!);
              if (_error != null || _user == null) {
                _isLoading = false;
                notifyListeners();
                if (!completer.isCompleted) {
                  completer.complete(false);
                }
                return;
              }
              await NotificationService.saveTokenAfterAuth();
            }
            _isLoading = false;
            notifyListeners();
            if (!completer.isCompleted) {
              completer.complete(true);
            }
          } catch (e) {
            debugPrint('Error in auto-verification: $e');
            _error = 'Auto-verification failed: $e';
            _isLoading = false;
            notifyListeners();
            if (!completer.isCompleted) {
              completer.complete(false);
            }
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          if (hasCompleted) return;
          hasCompleted = true;
          debugPrint('Verification failed: ${e.code} - ${e.message}');
          String errorMessage = 'Verification failed. Please try again.';

          // Provide more specific error messages
          switch (e.code) {
            case 'invalid-phone-number':
              errorMessage =
                  'Invalid phone number format. Please check and try again.';
              break;
            case 'too-many-requests':
              errorMessage = 'Too many requests. Please try again later.';
              break;
            case 'quota-exceeded':
              errorMessage = 'SMS quota exceeded. Please try again later.';
              break;
            case 'missing-phone-number':
              errorMessage = 'Phone number is required.';
              break;
            case 'invalid-verification-code':
              errorMessage = 'Invalid verification code.';
              break;
            case 'session-expired':
              errorMessage = 'Session expired. Please request a new code.';
              break;
            default:
              errorMessage = e.message ?? 'Verification failed: ${e.code}';
          }

          _error = errorMessage;
          _isLoading = false;
          notifyListeners();
          if (!completer.isCompleted) {
            completer.complete(false);
          }
        },
        codeSent: (String verificationId, int? resendToken) {
          if (hasCompleted) return;
          hasCompleted = true;
          debugPrint('Verification code sent successfully');
          _verificationId = verificationId;
          _resendToken = resendToken;
          _isLoading = false;
          notifyListeners();
          if (!completer.isCompleted) {
            completer.complete(true);
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          debugPrint('Auto-retrieval timeout');
          // Don't set hasCompleted here as codeSent should be called first
          _verificationId ??= verificationId;
        },
        timeout: const Duration(seconds: 60),
      );

      // Wait for the callback to complete (with a timeout)
      final result = await completer.future.timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          if (!hasCompleted) {
            hasCompleted = true;
            _error = 'OTP request timed out. Please try again.';
            _isLoading = false;
            notifyListeners();
          }
          return false;
        },
      );

      return result && _verificationId != null;
    } catch (e, stackTrace) {
      debugPrint('Exception in signInWithPhone: $e');
      debugPrint('Stack trace: $stackTrace');
      _error = 'Failed to send OTP. Please try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyOtp(String verificationId, String smsCode) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: smsCode,
      );

      final userCredential = await FirebaseService.auth.signInWithCredential(
        credential,
      );
      _user = userCredential.user;

      // Create or update user document in Firestore
      if (_user != null) {
        await _createOrUpdateUserProfile(_user!);
        if (_error != null || _user == null) {
          _isLoading = false;
          notifyListeners();
          return false;
        }
        // Save FCM token after successful authentication
        await NotificationService.saveTokenAfterAuth();
      }

      _isLoading = false;
      notifyListeners();
      return _user != null;
    } catch (e) {
      debugPrint('OTP verification error: $e');
      final msg = e.toString();
      if (msg.contains('invalid-verification-code') ||
          msg.contains('invalid-credential')) {
        _error = 'Invalid OTP. Please check and try again.';
      } else if (msg.contains('session-expired')) {
        _error = 'OTP expired. Please request a new code.';
      } else {
        _error = 'Verification failed. Please try again.';
      }
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> resendOtp(String phoneNumber) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      // Use Completer to wait for codeSent callback
      final completer = Completer<bool>();
      bool hasCompleted = false;

      await FirebaseService.auth.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) async {
          if (hasCompleted) return;
          hasCompleted = true;
          await FirebaseService.auth.signInWithCredential(credential);
          if (!completer.isCompleted) {
            completer.complete(true);
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          if (hasCompleted) return;
          hasCompleted = true;
          _error = e.message ?? 'Failed to resend OTP. Please try again.';
          _isLoading = false;
          notifyListeners();
          if (!completer.isCompleted) {
            completer.complete(false);
          }
        },
        codeSent: (String verificationId, int? resendToken) {
          if (hasCompleted) return;
          hasCompleted = true;
          _verificationId = verificationId;
          _resendToken = resendToken;
          _isLoading = false;
          notifyListeners();
          if (!completer.isCompleted) {
            completer.complete(true);
          }
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _verificationId ??= verificationId;
        },
        forceResendingToken: _resendToken,
        timeout: const Duration(seconds: 60),
      );

      // Wait for the callback to complete (with a timeout)
      final result = await completer.future.timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          if (!hasCompleted) {
            hasCompleted = true;
            _error = 'OTP resend timed out. Please try again.';
            _isLoading = false;
            notifyListeners();
          }
          return false;
        },
      );

      return result && _verificationId != null;
    } catch (e) {
      debugPrint('Resend OTP error: $e');
      _error = 'Failed to resend OTP. Please try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<String?> _validateMobileAccess(User user) async {
    try {
      final userDoc = FirebaseService.firestore
          .collection('users')
          .doc(user.uid);
      final userData = await userDoc.get();

      if (userData.exists) {
        final data = userData.data()!;
        final role = data['role'] as String? ?? 'player';
        if (role == 'venue_manager' || role == 'super_admin') {
          return 'This mobile number is already registered as a Vendor. Please use the Admin Panel to manage your venues, or use a different mobile number for player registration.';
        }
        if (data['status'] == 'Pending') {
          return 'Your vendor account is pending approval. Please sign in via the Admin Panel after approval.';
        }
        if (data['status'] == 'Inactive') {
          return 'Your account has been deactivated. Please contact support.';
        }
        return null;
      }

      // New Firebase Auth user — check if phone is already tied to a vendor account
      final phone = user.phoneNumber;
      if (phone != null && phone.isNotEmpty) {
        final phoneQuery = await FirebaseService.firestore
            .collection('users')
            .where('phone', isEqualTo: phone)
            .limit(1)
            .get();
        if (phoneQuery.docs.isNotEmpty) {
          final role = phoneQuery.docs.first.data()['role'] as String?;
          if (role == 'venue_manager' || role == 'super_admin') {
            return 'This mobile number is already registered as a Vendor. Please use the Admin Panel to manage your venues, or use a different mobile number for player registration.';
          }
        }
      }

      final email = user.email;
      if (email != null && email.isNotEmpty) {
        final emailQuery = await FirebaseService.firestore
            .collection('users')
            .where('email', isEqualTo: email)
            .limit(1)
            .get();
        if (emailQuery.docs.isNotEmpty) {
          final role = emailQuery.docs.first.data()['role'] as String?;
          if (role == 'venue_manager' || role == 'super_admin') {
            return 'This email is already registered as a Vendor. Please use the Admin Panel to manage your venues.';
          }
        }
      }

      return null;
    } catch (e) {
      debugPrint('Error validating mobile access: $e');
      return null;
    }
  }

  Future<void> _createOrUpdateUserProfile(User user) async {
    try {
      final accessError = await _validateMobileAccess(user);
      if (accessError != null) {
        _error = accessError;
        await FirebaseService.signOut();
        _user = null;
        _userRole = null;
        if (!_disposed) notifyListeners();
        return;
      }

      final userDoc = FirebaseService.firestore
          .collection('users')
          .doc(user.uid);
      final userData = await userDoc.get();

      if (!userData.exists) {
        // Create new user profile with 'player' role (mobile app users)
        await userDoc.set({
          'id': user.uid,
          'phone': user.phoneNumber,
          'email': user.email,
          'name': user.displayName ?? 'User',
          'photoURL': user.photoURL,
          'role': 'player', // Default role for new mobile users
          'status': 'Active',
          // Initialize new user profile fields with default values
          'walletBalance': 0.0,
          'level': 1,
          'progress': 0,
          'streak': 0,
          'notificationSettings': {
            'booking': true,
            'match': true,
            'social': true,
            'promotional': false,
          },
          'notificationPreferences': {
            'bookingUpdates': true,
            'matchUpdates': true,
            'socialUpdates': true,
            'promotions': false,
          },
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
        _userRole = 'player';
      } else {
        // Update existing user profile - only update contact info, preserve role and other fields
        final role = userData.data()?['role'] as String? ?? 'player';
        if (role == 'venue_manager' || role == 'super_admin') {
          _error =
              'This account is registered as a Vendor. Please use the Admin Panel.';
          await FirebaseService.signOut();
          _user = null;
          _userRole = null;
          if (!_disposed) notifyListeners();
          return;
        }
        await userDoc.update({
          'phone': user.phoneNumber,
          'email': user.email,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        _userRole = role;
      }
    } catch (e) {
      debugPrint('Error creating/updating user profile: $e');
    }
  }

  Future<void> signOut() async {
    // Delete FCM token before signing out
    await NotificationService.deleteToken();
    await FirebaseService.signOut();
    _user = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
