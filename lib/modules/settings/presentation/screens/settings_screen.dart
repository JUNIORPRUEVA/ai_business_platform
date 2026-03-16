import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import 'settings_api_keys_panel.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Configuración',
            subtitle:
                'Ajustes de empresa, claves API, integraciones, seguridad y facturación. Configuración aislada por tenant.',
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: TabBar(
              isScrollable: true,
              dividerColor: Colors.transparent,
              tabAlignment: TabAlignment.start,
              tabs: const [
                Tab(text: 'Empresa'),
                Tab(text: 'Claves API'),
                Tab(text: 'Seguridad'),
                Tab(text: 'Facturación'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Expanded(
            child: TabBarView(
              children: [
                _CompanyPanel(),
                SettingsApiKeysPanel(),
                _SecurityPanel(),
                _BillingPanel(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CompanyPanel extends StatelessWidget {
  const _CompanyPanel();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          ExecutiveGlassCard(
            child: SizedBox(
              height: 220,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Información de la empresa\n\nNombre, industria, zona horaria, locales y valores por defecto del equipo.'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SecurityPanel extends StatelessWidget {
  const _SecurityPanel();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          ExecutiveGlassCard(
            child: SizedBox(
              height: 220,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Seguridad\n\nSSO, MFA, logs de auditoría, allowlists de IP y secretos de firma de webhooks.'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BillingPanel extends StatelessWidget {
  const _BillingPanel();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          ExecutiveGlassCard(
            child: SizedBox(
              height: 220,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Facturación\n\nPlan, límites de uso, facturas y métodos de pago.'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
