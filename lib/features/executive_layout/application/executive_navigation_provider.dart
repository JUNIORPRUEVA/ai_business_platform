import 'package:flutter_riverpod/flutter_riverpod.dart';

const int executiveDashboardIndex = 0;
const int executiveSettingsIndex = 10;

final executiveSelectedIndexProvider = StateProvider<int>(
  (ref) => executiveDashboardIndex,
);
