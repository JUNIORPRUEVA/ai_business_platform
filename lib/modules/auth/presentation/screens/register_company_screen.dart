import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/auth_providers.dart';
import '../widgets/auth_shell.dart';

class RegisterCompanyScreen extends ConsumerStatefulWidget {
  const RegisterCompanyScreen({super.key});

  @override
  ConsumerState<RegisterCompanyScreen> createState() =>
      _RegisterCompanyScreenState();
}

class _RegisterCompanyScreenState extends ConsumerState<RegisterCompanyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyNameController = TextEditingController();
  final _adminNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _companyNameController.dispose();
    _adminNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return AuthShell(
      title: 'Crear empresa',
      subtitle:
          'Registra tu empresa y deja provisionado el bot inicial, el canal de WhatsApp y la sesión del administrador.',
      footer: Row(
        children: [
          Text(
            '¿Ya tienes cuenta?',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          TextButton(
            onPressed: isLoading
                ? null
                : () => Navigator.of(context).pushReplacementNamed('/login'),
            child: const Text('Iniciar sesión'),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            TextFormField(
              controller: _companyNameController,
              decoration: const InputDecoration(
                labelText: 'Nombre de la empresa',
                hintText: 'FULLTECH Systems',
              ),
              validator: (value) =>
                  value == null || value.trim().isEmpty ? 'Ingresa el nombre de la empresa' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _adminNameController,
              decoration: const InputDecoration(
                labelText: 'Nombre del administrador',
                hintText: 'Juan Pérez',
              ),
              validator: (value) =>
                  value == null || value.trim().isEmpty ? 'Ingresa el nombre del administrador' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo',
                hintText: 'admin@empresa.com',
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ingresa el correo';
                }
                if (!value.contains('@')) {
                  return 'Correo inválido';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Contraseña',
                hintText: 'Mínimo 8 caracteres',
              ),
              validator: (value) {
                if (value == null || value.length < 8) {
                  return 'La contraseña debe tener al menos 8 caracteres';
                }
                return null;
              },
            ),
            if (authState.errorMessage != null) ...[
              const SizedBox(height: 16),
              _ErrorBanner(message: authState.errorMessage!),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: isLoading ? null : _submit,
                icon: isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.business_rounded),
                label: Text(isLoading ? 'Creando empresa...' : 'Crear empresa'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    await ref.read(authControllerProvider.notifier).registerCompany(
          companyName: _companyNameController.text.trim(),
          adminName: _adminNameController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );

    if (!mounted) {
      return;
    }

    final authState = ref.read(authControllerProvider);
    if (authState.status == AuthStatus.authenticated) {
      Navigator.of(context).pushNamedAndRemoveUntil('/app', (_) => false);
    }
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: const Color(0xFF7F1D1D).withValues(alpha: 0.35),
        border: Border.all(color: const Color(0xFFFCA5A5).withValues(alpha: 0.35)),
      ),
      child: Text(message),
    );
  }
}
