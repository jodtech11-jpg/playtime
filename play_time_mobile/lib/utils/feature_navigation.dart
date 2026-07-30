import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/feature_flags_provider.dart';

/// Navigate to [route] if the feature is enabled; show Coming Soon if gated;
/// no-op (optionally snackbar) if hidden.
void navigateFeature(
  BuildContext context, {
  required String featureKey,
  required String route,
  String? hiddenMessage,
  bool replace = false,
}) {
  final flags = context.read<FeatureFlagsProvider>();
  final module = flags.module(featureKey);
  if (module.isHidden) {
    if (hiddenMessage != null && hiddenMessage.isNotEmpty) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(hiddenMessage),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return;
  }
  if (module.isComingSoon) {
    if (replace) {
      context.go('/coming-soon?feature=$featureKey');
    } else {
      context.push('/coming-soon?feature=$featureKey');
    }
    return;
  }
  if (replace) {
    context.go(route);
  } else {
    context.push(route);
  }
}

/// Wrap a child; if feature is coming soon on this screen route, replace body.
Widget featureScreenGate({
  required BuildContext context,
  required String featureKey,
  required Widget child,
}) {
  final module = context.watch<FeatureFlagsProvider>().module(featureKey);
  if (module.isHidden) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) {
        if (Navigator.canPop(context)) {
          context.pop();
        } else {
          context.go('/home');
        }
      }
    });
    return const Scaffold(
      backgroundColor: Color(0xFF0D0D0D),
      body: SizedBox.shrink(),
    );
  }
  if (module.isComingSoon) {
    return ComingSoonInline(featureKey: featureKey);
  }
  return child;
}

class ComingSoonInline extends StatelessWidget {
  final String featureKey;

  const ComingSoonInline({super.key, required this.featureKey});

  @override
  Widget build(BuildContext context) {
    final flags = context.watch<FeatureFlagsProvider>();
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D0D),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                flags.comingSoonTitleFor(featureKey),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                flags.comingSoonMessageFor(featureKey),
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[400], fontSize: 15),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
