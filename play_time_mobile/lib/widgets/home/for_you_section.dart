import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class ForYouItem {
  final String category;
  final String title;
  final String subtitle;
  final String meta;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  const ForYouItem({
    required this.category,
    required this.title,
    required this.subtitle,
    required this.meta,
    required this.icon,
    required this.accent,
    required this.onTap,
  });
}

class ForYouSection extends StatelessWidget {
  final List<ForYouItem> items;
  final bool isLoading;
  final VoidCallback onSeeAll;
  final VoidCallback onExploreVenues;

  const ForYouSection({
    super.key,
    required this.items,
    required this.isLoading,
    required this.onSeeAll,
    required this.onExploreVenues,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(onSeeAll: onSeeAll),
        const SizedBox(height: 16),
        if (isLoading)
          const _ForYouLoading()
        else if (items.isEmpty)
          _ForYouEmpty(onSeeAll: onSeeAll, onExploreVenues: onExploreVenues)
        else ...[
          _FeaturedRecommendation(item: items.first),
          if (items.length > 1) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 164,
              child: ListView.separated(
                clipBehavior: Clip.none,
                scrollDirection: Axis.horizontal,
                itemCount: items.length - 1,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) =>
                    _RecommendationCard(item: items[index + 1]),
              ),
            ),
          ],
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final VoidCallback onSeeAll;

  const _SectionHeader({required this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: const Icon(
                      Icons.auto_awesome,
                      color: AppColors.primary,
                      size: 16,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'For You',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              const Text(
                'Your next game, event, or best offer',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        TextButton.icon(
          onPressed: onSeeAll,
          iconAlignment: IconAlignment.end,
          icon: const Icon(Icons.arrow_forward, size: 16),
          label: const Text('See all'),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            minimumSize: const Size(48, 44),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}

class _FeaturedRecommendation extends StatelessWidget {
  final ForYouItem item;

  const _FeaturedRecommendation({required this.item});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${item.category}: ${item.title}. ${item.subtitle}',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: item.onTap,
          borderRadius: BorderRadius.circular(24),
          child: Ink(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                colors: [
                  item.accent.withValues(alpha: 0.24),
                  AppColors.surfaceDark,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(color: item.accent.withValues(alpha: 0.32)),
              boxShadow: [
                BoxShadow(
                  color: item.accent.withValues(alpha: 0.08),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: item.accent.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: item.accent.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Icon(item.icon, color: item.accent, size: 29),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _CategoryBadge(
                        category: item.category,
                        accent: item.accent,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.meta,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: item.accent,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          Icon(
                            Icons.arrow_forward_rounded,
                            color: item.accent,
                            size: 18,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  final ForYouItem item;

  const _RecommendationCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Semantics(
        button: true,
        label: '${item.category}: ${item.title}. ${item.subtitle}',
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: item.onTap,
            borderRadius: BorderRadius.circular(22),
            child: Ink(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceDark,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppColors.borderMedium),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: item.accent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(item.icon, color: item.accent, size: 20),
                      ),
                      const Spacer(),
                      _CategoryBadge(
                        category: item.category,
                        accent: item.accent,
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    item.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: item.accent,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CategoryBadge extends StatelessWidget {
  final String category;
  final Color accent;

  const _CategoryBadge({required this.category, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        category.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: accent,
          fontSize: 9,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.35,
        ),
      ),
    );
  }
}

class _ForYouEmpty extends StatelessWidget {
  final VoidCallback onSeeAll;
  final VoidCallback onExploreVenues;

  const _ForYouEmpty({required this.onSeeAll, required this.onExploreVenues});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.borderMedium),
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(17),
            ),
            child: const Icon(
              Icons.sports_score,
              color: AppColors.primary,
              size: 26,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Your next game starts here',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Join an open match or explore nearby venues to build your personalized feed.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onExploreVenues,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    minimumSize: const Size(0, 46),
                    side: const BorderSide(color: AppColors.borderMedium),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Explore venues'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: onSeeAll,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.backgroundDark,
                    minimumSize: const Size(0, 46),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text('Find a match'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ForYouLoading extends StatelessWidget {
  const _ForYouLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          height: 150,
          decoration: BoxDecoration(
            color: AppColors.surfaceDark,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.borderLight),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: List.generate(
            2,
            (index) => Expanded(
              child: Container(
                height: 120,
                margin: EdgeInsets.only(right: index == 0 ? 10 : 0),
                decoration: BoxDecoration(
                  color: AppColors.surfaceDark,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.borderLight),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
