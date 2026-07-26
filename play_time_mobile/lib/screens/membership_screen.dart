import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../theme/app_colors.dart';
import '../providers/membership_provider.dart';
import '../models/membership_plan.dart';
import '../services/payment_service.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';

class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key});

  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen> {
  bool _isProcessing = false;

  @override
  void dispose() {
    _isProcessing = false;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                padding: const EdgeInsets.all(16),
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
                      icon: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.arrow_back,
                          color: Colors.white,
                        ),
                      ),
                      onPressed: () {
                        if (Navigator.canPop(context)) {
                          context.pop();
                        } else {
                          context.go('/home');
                        }
                      },
                    ),
                    const Expanded(
                      child: Text(
                        'Unlock Play Time Pro',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 48),
                  ],
                ),
              ),
              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Current Plan
                      Consumer<MembershipProvider>(
                        builder: (context, membershipProvider, _) {
                          final activeMembership = membershipProvider
                              .getActiveMembership(null);
                          return Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceDark,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.05),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'CURRENT PLAN',
                                      style: TextStyle(
                                        color: Colors.grey[500],
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.35,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      activeMembership?.planName ??
                                          'Free Member',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    if (activeMembership != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text(
                                          'Expires: ${_formatDate(activeMembership.endDate)}',
                                          style: TextStyle(
                                            color: Colors.grey[500],
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: activeMembership != null
                                        ? AppColors.primary.withValues(
                                            alpha: 0.2,
                                          )
                                        : Colors.white.withValues(alpha: 0.05),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: activeMembership != null
                                          ? AppColors.primary
                                          : Colors.white.withValues(
                                              alpha: 0.05,
                                            ),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: activeMembership != null
                                              ? AppColors.primary
                                              : Colors.grey[600],
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        activeMembership != null
                                            ? 'ACTIVE'
                                            : 'FREE',
                                        style: TextStyle(
                                          color: activeMembership != null
                                              ? AppColors.primary
                                              : Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.25,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 40),
                      const Text(
                        'Choose Your Plan',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Level up your sports experience with exclusive perks.',
                        style: TextStyle(
                          color: Colors.grey[400],
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 32),
                      // Plans from Firestore
                      Consumer<MembershipProvider>(
                        builder: (context, membershipProvider, _) {
                          if (membershipProvider.isLoading) {
                            return const LoadingWidget(
                              message: 'Loading membership plans...',
                            );
                          }

                          if (membershipProvider.error != null) {
                            return ErrorDisplayWidget(
                              message: membershipProvider.error!,
                              onRetry: () =>
                                  membershipProvider.loadMembershipPlans(),
                            );
                          }

                          // Player membership only — never list vendor venue subscriptions here.
                          final plans = membershipProvider.platformPlans;

                          if (plans.isEmpty) {
                            return const EmptyStateWidget(
                              icon: Icons.card_membership,
                              title: 'No Play Time Pro plans yet',
                              message:
                                  'Venue subscriptions are listed on each venue page. Check back soon for platform Pro plans.',
                            );
                          }

                          final activeMemberships = membershipProvider
                              .memberships
                              .where((m) => m.isActive && m.isPlatformMembership)
                              .toList();

                          return Column(
                            children: plans.asMap().entries.map((entry) {
                              final index = entry.key;
                              final plan = entry.value;
                              final recommendedIndex =
                                  plans.length >= 3 ? 1 : 0;
                              final isRecommended = index == recommendedIndex;
                              final isCurrentPlan = activeMemberships.any(
                                (m) => m.planId == plan.id,
                              );

                              return Padding(
                                padding: EdgeInsets.only(
                                  bottom: index < plans.length - 1 ? 16 : 0,
                                ),
                                child: _buildPlanCard(
                                  plan: plan,
                                  isRecommended: isRecommended,
                                  isCurrentPlan: isCurrentPlan,
                                  onPurchase: () => _handlePurchase(plan),
                                ),
                              );
                            }).toList(),
                          );
                        },
                      ),
                      const SizedBox(height: 40),
                      const Text(
                        'Why Go Premium?',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 16),
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                        childAspectRatio: 0.85,
                        children: [
                          _buildBenefitCard(
                            icon: Icons.schedule,
                            title: 'Priority Access',
                            description: 'Book slots 24h before everyone else.',
                            color: Colors.blue,
                          ),
                          _buildBenefitCard(
                            icon: Icons.savings,
                            title: 'Save More',
                            description:
                                'Flat 10% off on all weekend bookings.',
                            color: Colors.purple,
                          ),
                          _buildBenefitCard(
                            icon: Icons.groups,
                            title: 'Community',
                            description: 'Access to exclusive tournaments.',
                            color: Colors.orange,
                          ),
                          _buildBenefitCard(
                            icon: Icons.support_agent,
                            title: 'Pro Support',
                            description: 'Dedicated line for instant help.',
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),
                      // Testimonial
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xFF28392e),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                        ),
                        child: Row(
                          children: [
                            ClipOval(
                              child: Image.network(
                                'https://lh3.googleusercontent.com/aida-public/AB6AXuDeUnAzDOF4y7lGcN-GsZBNLDo-ejqlRRhr89KXOjjqC9w0S2uA1YLAKEvUfTCKidcIwTRFyKTYvEe1tlP-ZkeN4EtKzkM1A8go3iCJaGKHP4sMAISjobTZ5HQBLfFkSQfH6DomKur9aNYJxytwtTVH2qqpO4F0sDqofZGC2WlG85mrHeYwGoDmWlWCf0NlQTyKYuTwTXv4zLdroRbRdYEJ1or9ctqcVRNdDFhmDCZcUX2P5rzw9zEYCugmz6GwVRVZLUwWDWtLpeoM',
                                width: 48,
                                height: 48,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '"Since joining Pro, I get the best turf slots every weekend in Chennai. Totally worth it!"',
                                    style: TextStyle(
                                      color: Colors.grey[200],
                                      fontSize: 14,
                                      fontStyle: FontStyle.italic,
                                      height: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    '— Vijay, Chennai',
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
                          ],
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${date.day} ${months[date.month - 1]}, ${date.year}';
  }

  Future<void> _handlePurchase(MembershipPlan plan) async {
    if (_isProcessing) return;

    setState(() => _isProcessing = true);
    String? membershipId;
    final membershipProvider = Provider.of<MembershipProvider>(
      context,
      listen: false,
    );

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please login to purchase membership'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      if (!plan.isPlatformPlan) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Venue subscriptions are purchased from the venue page.',
              ),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      membershipId = await membershipProvider.createMembership(
        planId: plan.id,
        venueId: 'platform',
        price: plan.price,
      );

      await PaymentService.processMembershipPayment(
        membershipId: membershipId,
        venueId: 'platform',
        amount: plan.price,
        userId: user.uid,
        userName: user.displayName ?? user.email ?? 'User',
        userEmail: user.email,
        userPhone: user.phoneNumber,
        onSuccess: (paymentId) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Play Time Pro activated!'),
                backgroundColor: AppColors.success,
              ),
            );
            context.pop();
          }
        },
        onError: (error) async {
          final pendingId = membershipId;
          if (pendingId != null) {
            await membershipProvider.cancelPendingMembership(pendingId);
          }
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Payment failed: $error'),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 5),
              ),
            );
          }
        },
      );
    } catch (e) {
      final pendingId = membershipId;
      if (pendingId != null) {
        await membershipProvider.cancelPendingMembership(pendingId);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to purchase membership: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  Widget _buildPlanCard({
    required MembershipPlan plan,
    required bool isRecommended,
    bool isCurrentPlan = false,
    String? venueName,
    required VoidCallback onPurchase,
  }) {
    String priceLabel = '/mo';
    if (plan.planType == '6 Months') {
      priceLabel = '/6mo';
    } else if (plan.planType == 'Annual') {
      priceLabel = '/yr';
    }
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isCurrentPlan
              ? AppColors.primary.withValues(alpha: 0.5)
              : isRecommended
              ? AppColors.primary
              : Colors.white.withValues(alpha: 0.1),
          width: (isRecommended || isCurrentPlan) ? 2 : 1,
        ),
      ),
      child: Stack(
        children: [
          if (isRecommended && !isCurrentPlan)
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 8,
                ),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.only(
                    topRight: Radius.circular(24),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
                child: const Text(
                  'BEST VALUE',
                  style: TextStyle(
                    color: AppColors.backgroundDark,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.25,
                  ),
                ),
              ),
            ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    plan.name.toUpperCase(),
                    style: TextStyle(
                      color: (isRecommended || isCurrentPlan)
                          ? Colors.white
                          : Colors.grey[400],
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.25,
                    ),
                  ),
                  if (isRecommended && !isCurrentPlan) ...[
                    const SizedBox(width: 8),
                    const Icon(Icons.bolt, color: AppColors.primary, size: 24),
                  ],
                  if (isCurrentPlan) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.5),
                        ),
                      ),
                      child: const Text(
                        'ACTIVE',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              if (venueName != null) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.location_on, size: 12, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text(
                      venueName,
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '₹${plan.price.toInt()}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    priceLabel,
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ...plan.features.map(
                (feature) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.check_circle,
                        color: AppColors.primary,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          feature,
                          style: TextStyle(
                            color: (isRecommended || isCurrentPlan)
                                ? Colors.white
                                : Colors.grey[300],
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_isProcessing || isCurrentPlan)
                      ? null
                      : onPurchase,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isCurrentPlan
                        ? Colors.white.withValues(alpha: 0.05)
                        : isRecommended
                        ? AppColors.primary
                        : Colors.white.withValues(alpha: 0.05),
                    foregroundColor: isCurrentPlan
                        ? Colors.grey[500]
                        : isRecommended
                        ? AppColors.backgroundDark
                        : Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(
                        color: isCurrentPlan
                            ? Colors.white.withValues(alpha: 0.05)
                            : isRecommended
                            ? AppColors.primary
                            : Colors.white.withValues(alpha: 0.1),
                      ),
                    ),
                  ),
                  child: _isProcessing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            isCurrentPlan
                                ? 'CURRENT PLAN'
                                : 'SELECT ${plan.name.toUpperCase()}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitCard({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(height: 12),
          Text(
            title.toUpperCase(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.25,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 10,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
