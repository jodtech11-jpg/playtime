import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/feature_flags_provider.dart';
import '../theme/app_colors.dart';
import '../utils/feature_navigation.dart';

class BottomNav extends StatelessWidget {
  final int currentIndex;

  const BottomNav({super.key, required this.currentIndex});

  @override
  Widget build(BuildContext context) {
    final flags = context.watch<FeatureFlagsProvider>();

    final items = <_NavSpec>[
      const _NavSpec(
        icon: Icons.home,
        label: 'Home',
        index: 0,
        route: '/home',
      ),
      if (flags.teamUp.isVisible)
        _NavSpec(
          icon: Icons.groups,
          label: 'Team Up',
          index: 1,
          route: '/team-up',
          featureKey: 'teamUp',
          comingSoon: flags.teamUp.isComingSoon,
        ),
      if (flags.feed.isVisible)
        _NavSpec(
          icon: Icons.sports_soccer,
          label: 'Feed',
          index: 2,
          route: '/social-feed',
          featureKey: 'feed',
          comingSoon: flags.feed.isComingSoon,
        ),
      const _NavSpec(
        icon: Icons.person,
        label: 'Profile',
        index: 3,
        route: '/profile',
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.backgroundDark.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.05)),
        ),
      ),
      child: SafeArea(
        child: Container(
          height: 70,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              for (final item in items)
                Expanded(
                  child: _buildNavItem(context, item),
                ),
              // Keep FAB gap when Team Up + Feed both visible (4 tabs)
              if (items.length >= 4) const SizedBox(width: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, _NavSpec item) {
    final isActive = currentIndex == item.index;
    return Semantics(
      label: item.label,
      button: true,
      child: GestureDetector(
        onTap: () {
          if (item.featureKey != null) {
            navigateFeature(
              context,
              featureKey: item.featureKey!,
              route: item.route,
              replace: true,
            );
            return;
          }
          context.go(item.route);
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              item.comingSoon ? Icons.hourglass_top_rounded : item.icon,
              color: isActive ? AppColors.primary : Colors.grey[400],
              size: 26,
            ),
            const SizedBox(height: 4),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isActive ? AppColors.primary : Colors.grey[400],
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.1,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavSpec {
  final IconData icon;
  final String label;
  final int index;
  final String route;
  final String? featureKey;
  final bool comingSoon;

  const _NavSpec({
    required this.icon,
    required this.label,
    required this.index,
    required this.route,
    this.featureKey,
    this.comingSoon = false,
  });
}
