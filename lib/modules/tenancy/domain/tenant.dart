import 'package:flutter/material.dart';

@immutable
class Tenant {
  const Tenant({
    required this.id,
    required this.name,
    required this.planLabel,
    required this.industryLabel,
  });

  final String id;
  final String name;
  final String planLabel;
  final String industryLabel;
}
