import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_providers.dart';
import '../domain/tenant.dart';

final tenantsProvider = Provider<List<Tenant>>((ref) {
  final authState = ref.watch(authControllerProvider);
  final session = authState.session;
  if (session != null) {
    return [
      Tenant(
        id: session.company.id,
        name: session.company.name,
        planLabel: session.company.plan,
        industryLabel: session.user.role,
      ),
    ];
  }

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
