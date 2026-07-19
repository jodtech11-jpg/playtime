import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_colors.dart';

class BottomNav extends StatelessWidget {
  final int currentIndex;

  const BottomNav({super.key, required this.currentIndex});

  @override
  Widget build(BuildContext context) {
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
              Expanded(
                child: _buildNavItem(
                  context,
                  icon: Icons.home,
                  label: 'Home',
                  index: 0,
                  route: '/home',
                ),
              ),
              Expanded(
                child: _buildNavItem(
                  context,
                  icon: Icons.groups,
                  label: 'Team Up',
                  index: 1,
                  route: '/team-up',
                ),
              ),
              const SizedBox(width: 8), // Small gap for FAB
              Expanded(
                child: _buildNavItem(
                  context,
                  icon: Icons.sports_soccer,
                  label: 'Feed',
                  index: 2,
                  route: '/social-feed',
                ),
              ),
              Expanded(
                child: _buildNavItem(
                  context,
                  icon: Icons.person,
                  label: 'Profile',
                  index: 3,
                  route: '/profile',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required int index,
    required String route,
  }) {
    final isActive = currentIndex == index;
    return Semantics(
      label: label,
      button: true,
      child: GestureDetector(
        onTap: () => context.go(route),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isActive ? AppColors.primary : Colors.grey[400],
              size: 26,
            ),
            const SizedBox(height: 4),
            Text(
              label,
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
