import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/tenant.dart';

final tenantsProvider = Provider<List<Tenant>>((ref) {
  return const [
    Tenant(
      id: 'fulltech',
      name: 'FULLTECH Systems',
      planLabel: 'Enterprise',
      industryLabel: 'Retail + Ops',
    ),
    Tenant(
      id: 'acme',
      name: 'Acme Commerce',
      planLabel: 'Pro',
      industryLabel: 'E-commerce',
    ),
  ];
});

final selectedTenantIdProvider = StateProvider<String>((ref) {
  return ref.read(tenantsProvider).first.id;
});

final selectedTenantProvider = Provider<Tenant>((ref) {
  final tenants = ref.watch(tenantsProvider);
  final id = ref.watch(selectedTenantIdProvider);
  return tenants.firstWhere((t) => t.id == id, orElse: () => tenants.first);
});
