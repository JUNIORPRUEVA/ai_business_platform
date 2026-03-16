import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'modules/auth/presentation/screens/auth_gate_screen.dart';
import 'modules/auth/presentation/screens/login_screen.dart';
import 'modules/auth/presentation/screens/register_company_screen.dart';
import 'features/executive_layout/presentation/screens/executive_layout_demo_screen.dart';
import 'features/enterprise_bot_workspace/presentation/screens/enterprise_bot_workspace_screen.dart';

class FullPosApp extends StatelessWidget {
  const FullPosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const ProviderScope(
      child: _AppShell(),
    );
  }
}

class _AppShell extends StatelessWidget {
  const _AppShell();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FULLPOS Enterprise Bot',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.executiveDark(),
      darkTheme: AppTheme.executiveDark(),
      themeMode: ThemeMode.dark,
      routes: {
        '/login': (_) => const LoginScreen(),
        '/register': (_) => const RegisterCompanyScreen(),
        '/app': (_) => const AuthGateScreen(),
        '/workspace': (_) => const EnterpriseBotWorkspaceScreen(),
        '/executive-demo': (_) => const ExecutiveLayoutDemoScreen(),
      },
      home: const AuthGateScreen(),
    );
  }
}
