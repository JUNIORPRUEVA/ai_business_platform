import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    const baseBackground = Color(0xFFF3F6FB);
    const surface = Colors.white;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF165DFF),
      brightness: Brightness.light,
    ).copyWith(
      surface: surface,
      surfaceContainerHighest: const Color(0xFFE8EEF8),
      outlineVariant: const Color(0xFFD8E1ED),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: baseBackground,
      fontFamily: 'Segoe UI',
      shadowColor: const Color(0x140F172A),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.4),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFFF5F8FD),
        selectedColor: colorScheme.primary.withValues(alpha: 0.12),
        disabledColor: const Color(0xFFE5EAF2),
        side: BorderSide(color: colorScheme.outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        labelStyle: const TextStyle(fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      ),
      dividerTheme: DividerThemeData(
        color: colorScheme.outlineVariant,
        space: 1,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          side: BorderSide(color: colorScheme.outlineVariant),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: Color(0xFF111827),
        ),
        titleLarge: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Color(0xFF111827),
        ),
        titleMedium: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: Color(0xFF111827),
        ),
        bodyLarge: TextStyle(
          fontSize: 14,
          height: 1.45,
          color: Color(0xFF334155),
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          height: 1.45,
          color: Color(0xFF475569),
        ),
        labelLarge: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  static ThemeData executiveDark() {
    const baseBackground = Colors.transparent;
    const surface = Color(0xFF15264A);

    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF60A5FA),
      brightness: Brightness.dark,
    ).copyWith(
      surface: surface,
      surfaceContainerHighest: const Color(0xFF1A2E58),
      outlineVariant: const Color(0xFF2A3A57),
      secondary: const Color(0xFF38BDF8),
    );

    final baseTextTheme = ThemeData.dark().textTheme;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: baseBackground,
      canvasColor: Colors.transparent,
      fontFamily: 'Inter',
      fontFamilyFallback: const [
        'Plus Jakarta Sans',
        'Segoe UI',
        'Roboto',
        'Arial',
      ],
      shadowColor: Colors.black.withValues(alpha: 0.30),
      textTheme: baseTextTheme.copyWith(
        titleLarge: baseTextTheme.titleLarge?.copyWith(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: colorScheme.onSurface.withValues(alpha: 0.92),
        ),
        titleMedium: baseTextTheme.titleMedium?.copyWith(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: colorScheme.onSurface.withValues(alpha: 0.90),
        ),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(
          fontSize: 14,
          height: 1.5,
          color: colorScheme.onSurface.withValues(alpha: 0.84),
        ),
        bodySmall: baseTextTheme.bodySmall?.copyWith(
          fontSize: 13,
          height: 1.4,
          color: colorScheme.onSurface.withValues(alpha: 0.78),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: colorScheme.outlineVariant.withValues(alpha: 0.65),
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surface.withValues(alpha: 0.22),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.72)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.72)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.primary.withValues(alpha: 0.92), width: 1.4),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      menuTheme: MenuThemeData(
        style: MenuStyle(
          backgroundColor: WidgetStatePropertyAll(colorScheme.surface.withValues(alpha: 0.96)),
          elevation: const WidgetStatePropertyAll(0),
          side: WidgetStatePropertyAll(
            BorderSide(color: colorScheme.outlineVariant.withValues(alpha: 0.75)),
          ),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          ),
          padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(vertical: 8)),
        ),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: const Color(0xFF0B1220).withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.75)),
        ),
        textStyle: baseTextTheme.bodySmall?.copyWith(
          color: colorScheme.onSurface.withValues(alpha: 0.85),
        ),
      ),
    );
  }
}