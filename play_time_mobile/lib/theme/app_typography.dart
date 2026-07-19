import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Shared typography tuned for small phone widths — avoids heavy letter-spacing
/// that forces labels onto extra lines.
abstract final class AppTypography {
  static const double captionSpacing = 0.2;
  static const double labelSpacing = 0.25;
  static const double buttonSpacing = 0.15;

  static TextStyle caption({
    Color color = AppColors.textSecondary,
    double fontSize = 10,
    FontWeight fontWeight = FontWeight.w700,
  }) => TextStyle(
    color: color,
    fontSize: fontSize,
    fontWeight: fontWeight,
    letterSpacing: captionSpacing,
    height: 1.2,
  );

  static TextStyle label({
    Color color = AppColors.textPrimary,
    double fontSize = 12,
    FontWeight fontWeight = FontWeight.w700,
  }) => TextStyle(
    color: color,
    fontSize: fontSize,
    fontWeight: fontWeight,
    letterSpacing: labelSpacing,
    height: 1.25,
  );

  static TextStyle title({
    Color color = AppColors.textPrimary,
    double fontSize = 16,
    FontWeight fontWeight = FontWeight.w800,
  }) => TextStyle(
    color: color,
    fontSize: fontSize,
    fontWeight: fontWeight,
    letterSpacing: 0,
    height: 1.2,
  );

  static TextStyle heading({
    Color color = AppColors.textPrimary,
    double fontSize = 22,
    FontWeight fontWeight = FontWeight.w900,
  }) => TextStyle(
    color: color,
    fontSize: fontSize,
    fontWeight: fontWeight,
    letterSpacing: -0.3,
    height: 1.15,
  );

  static TextStyle button({
    Color color = AppColors.backgroundDark,
    double fontSize = 14,
  }) => TextStyle(
    color: color,
    fontSize: fontSize,
    fontWeight: FontWeight.w800,
    letterSpacing: buttonSpacing,
    height: 1.2,
  );

  /// Slightly shrink text on very narrow devices (e.g. iPhone SE, small Android).
  static double widthScale(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 340) return 0.92;
    if (width < 380) return 0.96;
    return 1.0;
  }

  static TextStyle scaled(BuildContext context, TextStyle style) {
    final scale = widthScale(context);
    if (scale == 1.0) return style;
    return style.copyWith(fontSize: (style.fontSize ?? 14) * scale);
  }
}
