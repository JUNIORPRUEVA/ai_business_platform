import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/auth_providers.dart';
import '../widgets/auth_shell.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _companyIdController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _companyIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return AuthShell(
      title: 'Iniciar sesión',
      subtitle:
          'Accede a tu empresa, recupera tu sesión y continúa gestionando WhatsApp, IA y automatizaciones.',
      footer: Row(
        children: [
          Text(
            '¿No tienes empresa aún?',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          TextButton(
            onPressed: isLoading
                ? null
                : () => Navigator.of(context).pushReplacementNamed('/register'),
            child: const Text('Crear empresa'),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo',
                hintText: 'admin@empresa.com',
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ingresa tu correo';
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
            const SizedBox(height: 14),
            TextFormField(
              controller: _companyIdController,
              decoration: const InputDecoration(
                labelText: 'Company ID (opcional)',
                hintText: 'Solo si tu correo existe en varias empresas',
              ),
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
                    : const Icon(Icons.login_rounded),
                label: Text(isLoading ? 'Entrando...' : 'Entrar'),
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

    await ref.read(authControllerProvider.notifier).login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          companyId: _companyIdController.text.trim().isEmpty
              ? null
              : _companyIdController.text.trim(),
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
