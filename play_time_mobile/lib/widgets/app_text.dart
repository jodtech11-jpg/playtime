import 'package:flutter/material.dart';
import '../theme/app_typography.dart';

enum AppTextVariant { heading, title, label, caption, body }

/// Text widget with safe defaults: ellipsis, sensible line height, no wide tracking.
class AppText extends StatelessWidget {
  final String data;
  final TextStyle? style;
  final AppTextVariant variant;
  final int? maxLines;
  final TextOverflow overflow;
  final TextAlign? textAlign;
  final bool uppercase;
  final bool softWrap;

  const AppText(
    this.data, {
    super.key,
    this.style,
    this.variant = AppTextVariant.body,
    this.maxLines,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    this.uppercase = false,
    this.softWrap = true,
  });

  const AppText.heading(
    this.data, {
    super.key,
    this.style,
    this.maxLines = 2,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    this.uppercase = false,
  }) : variant = AppTextVariant.heading,
       softWrap = true;

  const AppText.title(
    this.data, {
    super.key,
    this.style,
    this.maxLines = 2,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    this.uppercase = false,
  }) : variant = AppTextVariant.title,
       softWrap = true;

  const AppText.label(
    this.data, {
    super.key,
    this.style,
    this.maxLines = 1,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    this.uppercase = false,
  }) : variant = AppTextVariant.label,
       softWrap = false;

  const AppText.caption(
    this.data, {
    super.key,
    this.style,
    this.maxLines = 1,
    this.overflow = TextOverflow.ellipsis,
    this.textAlign,
    this.uppercase = false,
  }) : variant = AppTextVariant.caption,
       softWrap = false;

  TextStyle _baseStyle(BuildContext context) {
    switch (variant) {
      case AppTextVariant.heading:
        return AppTypography.heading();
      case AppTextVariant.title:
        return AppTypography.title();
      case AppTextVariant.label:
        return AppTypography.label();
      case AppTextVariant.caption:
        return AppTypography.caption();
      case AppTextVariant.body:
        return Theme.of(context).textTheme.bodyMedium ??
            const TextStyle(color: Colors.white, fontSize: 14);
    }
  }

  int _defaultMaxLines() {
    switch (variant) {
      case AppTextVariant.label:
      case AppTextVariant.caption:
        return 1;
      case AppTextVariant.title:
        return 2;
      case AppTextVariant.heading:
        return 2;
      case AppTextVariant.body:
        return 3;
    }
  }

  @override
  Widget build(BuildContext context) {
    final base = AppTypography.scaled(context, _baseStyle(context));
    final resolvedMaxLines = maxLines ?? _defaultMaxLines();
    final text = uppercase ? data.toUpperCase() : data;

    return Text(
      text,
      style: base.merge(style),
      maxLines: resolvedMaxLines,
      overflow: overflow,
      textAlign: textAlign,
      softWrap: softWrap && resolvedMaxLines > 1,
    );
  }
}

/// Use inside [Row]/[Flex] so long strings truncate instead of wrapping.
class AppTextFlexible extends StatelessWidget {
  final String data;
  final TextStyle? style;
  final AppTextVariant variant;
  final int maxLines;
  final TextAlign? textAlign;
  final bool uppercase;

  const AppTextFlexible(
    this.data, {
    super.key,
    this.style,
    this.variant = AppTextVariant.body,
    this.maxLines = 1,
    this.textAlign,
    this.uppercase = false,
  });

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: AppText(
        data,
        style: style,
        variant: variant,
        maxLines: maxLines,
        textAlign: textAlign,
        uppercase: uppercase,
        softWrap: false,
      ),
    );
  }
}
