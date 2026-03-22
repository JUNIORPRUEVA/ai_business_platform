import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    const baseBackground = Color(0xFFF4F1EA);
    const surface = Color(0xFFFFFDFA);
    const surfaceSoft = Color(0xFFF6F1E8);
    const surfaceMuted = Color(0xFFE9E2D7);
    const ink = Color(0xFF1F2A37);
    const mutedInk = Color(0xFF667085);
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0B6E61),
      brightness: Brightness.light,
    ).copyWith(
      surface: surface,
      surfaceContainerHighest: surfaceSoft,
      outlineVariant: const Color(0xFFE0D8CC),
      primary: const Color(0xFF0B6E61),
      secondary: const Color(0xFFAE7A46),
      tertiary: const Color(0xFF2E6F95),
      onSurface: ink,
      onPrimary: Colors.white,
    );

    final baseTextTheme = ThemeData.light().textTheme;

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: baseBackground,
      fontFamily: 'Segoe UI',
      canvasColor: Colors.transparent,
      shadowColor: const Color(0x1A201F1D),
      splashFactory: NoSplash.splashFactory,
      textTheme: baseTextTheme.copyWith(
        headlineMedium: baseTextTheme.headlineMedium?.copyWith(
          fontSize: 30,
          fontWeight: FontWeight.w800,
          color: ink,
          height: 1.1,
          letterSpacing: -0.6,
        ),
        titleLarge: baseTextTheme.titleLarge?.copyWith(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: ink,
          height: 1.15,
          letterSpacing: -0.4,
        ),
        titleMedium: baseTextTheme.titleMedium?.copyWith(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: ink,
          height: 1.2,
        ),
        bodyLarge: baseTextTheme.bodyLarge?.copyWith(
          fontSize: 14,
          color: ink,
          height: 1.55,
        ),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(
          fontSize: 14,
          color: mutedInk,
          height: 1.5,
        ),
        bodySmall: baseTextTheme.bodySmall?.copyWith(
          fontSize: 13,
          color: mutedInk,
          height: 1.45,
        ),
        labelLarge: baseTextTheme.labelLarge?.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: ink,
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
      ),
      menuTheme: MenuThemeData(
        style: MenuStyle(
          backgroundColor: const WidgetStatePropertyAll(surface),
          elevation: const WidgetStatePropertyAll(0),
          side: WidgetStatePropertyAll(
            BorderSide(color: colorScheme.outlineVariant),
          ),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(vertical: 8),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceSoft,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        labelStyle: const TextStyle(
          color: mutedInk,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.5),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceSoft,
        selectedColor: colorScheme.primary.withValues(alpha: 0.12),
        disabledColor: surfaceMuted,
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
          backgroundColor: colorScheme.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
          side: BorderSide(color: colorScheme.outlineVariant),
          foregroundColor: ink,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        dividerColor: Colors.transparent,
        labelColor: ink,
        unselectedLabelColor: mutedInk,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        unselectedLabelStyle:
            const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        indicator: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colorScheme.outlineVariant),
          boxShadow: const [
            BoxShadow(
              color: Color(0x140F172A),
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        splashFactory: NoSplash.splashFactory,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colorScheme.primary;
          }
          return Colors.white;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colorScheme.primary.withValues(alpha: 0.32);
          }
          return surfaceMuted;
        }),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: const Color(0xFF24322D).withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF42524B)),
        ),
        textStyle: const TextStyle(
          color: Color(0xFFF5F7F2),
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  static ThemeData executiveDark() {
    return light().copyWith(brightness: Brightness.dark);
  }
}
