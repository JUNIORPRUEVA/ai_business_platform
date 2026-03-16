import 'package:flutter/material.dart';

@immutable
class ExecutiveNavItem {
  const ExecutiveNavItem({
    required this.label,
    required this.icon,
  });

  final String label;
  final IconData icon;
}
