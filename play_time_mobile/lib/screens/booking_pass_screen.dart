import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../theme/app_colors.dart';
import '../models/booking.dart';
import '../services/firestore_service.dart';
import '../constants/app_strings.dart';

/// Booking pass screen: shows venue, date, time, status and a QR code / short code for staff validation.
class BookingPassScreen extends StatefulWidget {
  final String? bookingId;

  const BookingPassScreen({super.key, this.bookingId});

  @override
  State<BookingPassScreen> createState() => _BookingPassScreenState();
}

class _BookingPassScreenState extends State<BookingPassScreen> {
  Booking? _booking;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBooking();
  }

  Future<void> _loadBooking() async {
    final id = widget.bookingId;
    if (id == null || id.isEmpty) {
      setState(() {
        _loading = false;
        _error = AppStrings.somethingWentWrong;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final booking = await FirestoreService.getBookingById(id);
    if (!mounted) return;
    setState(() {
      _booking = booking;
      _loading = false;
      if (booking == null) _error = 'Booking not found';
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
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.arrow_back, color: Colors.white),
          ),
          onPressed: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/bookings');
            }
          },
        ),
        title: const Text(
          'Booking pass',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }
    if (_error != null || _booking == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.grey[600]),
              const SizedBox(height: 16),
              Text(
                _error ?? 'Booking not found',
                style: TextStyle(color: Colors.grey[400], fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _loadBooking,
                icon: const Icon(Icons.refresh, size: 20),
                label: const Text('Retry'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.backgroundDark,
                ),
              ),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: () => context.go('/bookings'),
                icon: const Icon(Icons.list, color: AppColors.primary),
                label: const Text(
                  'My Bookings',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final b = _booking!;
    final canShowPass = b.status == BookingStatus.confirmed;
    final statusColor = b.status == BookingStatus.confirmed
        ? Colors.green
        : b.status == BookingStatus.pending
        ? Colors.orange
        : b.status == BookingStatus.completed
        ? Colors.blue
        : Colors.grey;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surfaceDark,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Column(
              children: [
                Text(
                  b.venueName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Text(
                    b.status.toString().toUpperCase(),
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.25,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.event, color: Colors.grey[400], size: 18),
                    const SizedBox(width: 8),
                    Text(
                      b.date,
                      style: TextStyle(color: Colors.grey[300], fontSize: 14),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.schedule, color: Colors.grey[400], size: 18),
                    const SizedBox(width: 8),
                    Text(
                      b.time,
                      style: TextStyle(color: Colors.grey[300], fontSize: 14),
                    ),
                  ],
                ),
                if (b.sport.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.sports, color: Colors.grey[400], size: 18),
                      const SizedBox(width: 8),
                      Text(
                        b.displaySport,
                        style: TextStyle(color: Colors.grey[300], fontSize: 14),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
                if (canShowPass) ...[
                  Semantics(
                    label: 'Booking entry QR code',
                    image: true,
                    child: QrImageView(
                      data: b.id,
                      version: QrVersions.auto,
                      size: 180,
                      backgroundColor: Colors.white,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: Color(0xFF1a1a1a),
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: Color(0xFF1a1a1a),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Booking Ref: ${b.referenceId}',
                    style: const TextStyle(
                      color: AppColors.textTertiary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Show this pass at the venue',
                    style: TextStyle(
                      color: AppColors.textTertiary,
                      fontSize: 12,
                    ),
                  ),
                ] else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: statusColor.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          b.status == BookingStatus.pending
                              ? Icons.schedule_rounded
                              : Icons.block_rounded,
                          color: statusColor,
                          size: 30,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          b.status == BookingStatus.pending
                              ? 'Pass available after confirmation'
                              : 'This booking pass is not active',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          b.status == BookingStatus.pending
                              ? 'Payment or venue confirmation is still pending.'
                              : 'Cancelled bookings cannot be used for entry.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (b.venueId != null && b.venueId!.isNotEmpty)
            SizedBox(
              width: double.infinity,
              child: Semantics(
                label: 'View venue',
                button: true,
                child: OutlinedButton.icon(
                  onPressed: () =>
                      context.push('/venue-detail?id=${b.venueId}'),
                  icon: const Icon(
                    Icons.place,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  label: const Text(
                    'View venue',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.primary),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
