import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../modules/auth/application/auth_providers.dart';
import '../../../../modules/auth/data/auth_api_client.dart';
import '../../../../modules/auth/domain/auth_session.dart';
import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';
import 'settings_api_keys_panel.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const DefaultTabController(
      length: 4,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ModuleHeader(
            title: 'Configuración',
            subtitle:
                'Ajustes de empresa, claves API, integraciones, seguridad y facturación. Configuración aislada por tenant.',
          ),
          SizedBox(height: 18),
          ExecutiveGlassCard(
            padding: const EdgeInsets.all(8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TabBar(
                isScrollable: true,
                dividerColor: Colors.transparent,
                tabAlignment: TabAlignment.start,
                tabs: [
                  Tab(text: 'Empresa'),
                  Tab(text: 'Claves API'),
                  Tab(text: 'Seguridad'),
                  Tab(text: 'Facturación'),
                ],
              ),
            ),
          ),
          SizedBox(height: 12),
          Expanded(
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

class _CompanyPanel extends ConsumerStatefulWidget {
  const _CompanyPanel();

  @override
  ConsumerState<_CompanyPanel> createState() => _CompanyPanelState();
}

class _CompanyPanelState extends ConsumerState<_CompanyPanel> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _websiteController;
  late final TextEditingController _taxIdController;
  late final TextEditingController _addressLine1Controller;
  late final TextEditingController _addressLine2Controller;
  late final TextEditingController _cityController;
  late final TextEditingController _stateController;
  late final TextEditingController _countryController;
  late final TextEditingController _postalCodeController;
  late final TextEditingController _descriptionController;

  String? _hydratedCompanyId;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _phoneController = TextEditingController();
    _emailController = TextEditingController();
    _websiteController = TextEditingController();
    _taxIdController = TextEditingController();
    _addressLine1Controller = TextEditingController();
    _addressLine2Controller = TextEditingController();
    _cityController = TextEditingController();
    _stateController = TextEditingController();
    _countryController = TextEditingController();
    _postalCodeController = TextEditingController();
    _descriptionController = TextEditingController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _websiteController.dispose();
    _taxIdController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    _postalCodeController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final company = ref.watch(authControllerProvider).session?.company;
    _hydrate(company);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExecutiveGlassCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Perfil de la empresa',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Edita la información completa de la tienda para mantener actualizado el nombre, contacto comercial y datos operativos.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color:
                          theme.colorScheme.onSurface.withValues(alpha: 0.72),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 24),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final useTwoColumns = constraints.maxWidth >= 820;
                      return Wrap(
                        spacing: 16,
                        runSpacing: 16,
                        children: [
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _nameController,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                labelText: 'Nombre de la empresa',
                                hintText: 'FULLTECH Systems',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Ingresa el nombre de la empresa';
                                }
                                return null;
                              },
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _phoneController,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                labelText: 'Teléfono',
                                hintText: '+57 300 123 4567',
                              ),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _emailController,
                              enabled: !_isSaving,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(
                                labelText: 'Correo de la empresa',
                                hintText: 'contacto@fulltech.com',
                              ),
                              validator: (value) {
                                final trimmed = value?.trim() ?? '';
                                if (trimmed.isEmpty) {
                                  return null;
                                }
                                final emailPattern =
                                    RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                                if (!emailPattern.hasMatch(trimmed)) {
                                  return 'Ingresa un correo válido';
                                }
                                return null;
                              },
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _websiteController,
                              enabled: !_isSaving,
                              keyboardType: TextInputType.url,
                              decoration: const InputDecoration(
                                labelText: 'Sitio web',
                                hintText: 'https://fulltech.com',
                              ),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _taxIdController,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                labelText: 'NIT / documento fiscal',
                                hintText: '900123456-7',
                              ),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              initialValue: company?.plan ?? '',
                              enabled: false,
                              decoration: const InputDecoration(
                                labelText: 'Plan actual',
                              ),
                            ),
                          ),
                          _CompanyField(
                            width: constraints.maxWidth,
                            child: TextFormField(
                              controller: _addressLine1Controller,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                labelText: 'Dirección principal',
                                hintText: 'Calle 10 # 20-30',
                              ),
                            ),
                          ),
                          _CompanyField(
                            width: constraints.maxWidth,
                            child: TextFormField(
                              controller: _addressLine2Controller,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                labelText: 'Dirección complementaria',
                                hintText: 'Local 4, Centro Comercial',
                              ),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _cityController,
                              enabled: !_isSaving,
                              decoration:
                                  const InputDecoration(labelText: 'Ciudad'),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _stateController,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                  labelText: 'Estado / departamento'),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _countryController,
                              enabled: !_isSaving,
                              decoration:
                                  const InputDecoration(labelText: 'País'),
                            ),
                          ),
                          _CompanyField(
                            width: _fieldWidth(
                                constraints.maxWidth, useTwoColumns),
                            child: TextFormField(
                              controller: _postalCodeController,
                              enabled: !_isSaving,
                              decoration: const InputDecoration(
                                  labelText: 'Código postal'),
                            ),
                          ),
                          _CompanyField(
                            width: constraints.maxWidth,
                            child: TextFormField(
                              controller: _descriptionController,
                              enabled: !_isSaving,
                              maxLines: 4,
                              decoration: const InputDecoration(
                                labelText: 'Descripción de la tienda',
                                hintText:
                                    'Describe el enfoque comercial, servicios y detalles importantes de la empresa.',
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 18),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        color: const Color(0xFF7F1D1D).withValues(alpha: 0.30),
                        border: Border.all(
                          color:
                              const Color(0xFFFCA5A5).withValues(alpha: 0.35),
                        ),
                      ),
                      child: Text(_errorMessage!),
                    ),
                  ],
                  const SizedBox(height: 22),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: _isSaving
                            ? null
                            : () => _hydrate(company, force: true),
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Restablecer'),
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: _isSaving ? null : _save,
                        icon: _isSaving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.storefront_rounded),
                        label: Text(
                            _isSaving ? 'Guardando...' : 'Guardar empresa'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  double _fieldWidth(double maxWidth, bool useTwoColumns) {
    if (!useTwoColumns) {
      return maxWidth;
    }
    return (maxWidth - 16) / 2;
  }

  void _hydrate(AuthCompany? company, {bool force = false}) {
    if (company == null) {
      return;
    }
    if (!force && _hydratedCompanyId == company.id) {
      return;
    }

    _hydratedCompanyId = company.id;
    _nameController.text = company.name;
    _phoneController.text = company.phone ?? '';
    _emailController.text = company.email ?? '';
    _websiteController.text = company.website ?? '';
    _taxIdController.text = company.taxId ?? '';
    _addressLine1Controller.text = company.addressLine1 ?? '';
    _addressLine2Controller.text = company.addressLine2 ?? '';
    _cityController.text = company.city ?? '';
    _stateController.text = company.state ?? '';
    _countryController.text = company.country ?? '';
    _postalCodeController.text = company.postalCode ?? '';
    _descriptionController.text = company.description ?? '';
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      await ref.read(authControllerProvider.notifier).updateCompany(
            name: _nameController.text.trim(),
            phone: _phoneController.text,
            email: _emailController.text,
            website: _websiteController.text,
            taxId: _taxIdController.text,
            addressLine1: _addressLine1Controller.text,
            addressLine2: _addressLine2Controller.text,
            city: _cityController.text,
            regionState: _stateController.text,
            country: _countryController.text,
            postalCode: _postalCodeController.text,
            description: _descriptionController.text,
          );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(content: Text('Empresa actualizada correctamente.')),
      );
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }
}

class _CompanyField extends StatelessWidget {
  const _CompanyField({required this.width, required this.child});

  final double width;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: width, child: child);
  }
}

class _SecurityPanel extends StatelessWidget {
  const _SecurityPanel();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExecutiveGlassCard(
            child: SizedBox(
              height: 220,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                    'Seguridad\n\nSSO, MFA, logs de auditoría, allowlists de IP y secretos de firma de webhooks.'),
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
    return const SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExecutiveGlassCard(
            child: SizedBox(
              height: 220,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                    'Facturación\n\nPlan, límites de uso, facturas y métodos de pago.'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
