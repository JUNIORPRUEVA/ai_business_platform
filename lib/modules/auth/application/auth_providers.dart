import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_api_client.dart';
import '../data/auth_token_store.dart';
import '../domain/auth_session.dart';

enum AuthStatus { loading, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.errorMessage,
  });

  const AuthState.loading() : this(status: AuthStatus.loading);
  const AuthState.unauthenticated({String? errorMessage})
      : this(
          status: AuthStatus.unauthenticated,
          errorMessage: errorMessage,
        );
  const AuthState.authenticated(AuthSession session)
      : this(status: AuthStatus.authenticated, session: session);

  final AuthStatus status;
  final AuthSession? session;
  final String? errorMessage;
}

final authApiClientProvider = Provider<AuthApiClient>((ref) {
  return AuthApiClient();
});

final authTokenStoreProvider = Provider<AuthTokenStore>((ref) {
  return AuthTokenStore();
});

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  late final AuthApiClient _apiClient = ref.read(authApiClientProvider);
  late final AuthTokenStore _tokenStore = ref.read(authTokenStoreProvider);

  @override
  AuthState build() {
    Future<void>.microtask(restoreSession);
    return const AuthState.loading();
  }

  Future<void> restoreSession() async {
    final token = await _tokenStore.read();
    if (token == null || token.trim().isEmpty) {
      state = const AuthState.unauthenticated();
      return;
    }

    try {
      final session = await _apiClient.getSession(token);
      state = AuthState.authenticated(session);
    } on AuthApiException catch (error) {
      await _tokenStore.clear();
      state = AuthState.unauthenticated(errorMessage: error.message);
    }
  }

  Future<void> login({
    required String email,
    required String password,
    String? companyId,
  }) async {
    state = const AuthState.loading();
    try {
      final token = await _apiClient.login(
        email: email,
        password: password,
        companyId: companyId,
      );
      await _tokenStore.write(token);
      final session = await _apiClient.getSession(token);
      state = AuthState.authenticated(session);
    } on AuthApiException catch (error) {
      state = AuthState.unauthenticated(errorMessage: error.message);
    }
  }

  Future<void> registerCompany({
    required String companyName,
    required String adminName,
    required String email,
    required String password,
  }) async {
    state = const AuthState.loading();
    try {
      final token = await _apiClient.registerCompany(
        companyName: companyName,
        adminName: adminName,
        email: email,
        password: password,
      );
      await _tokenStore.write(token);
      final session = await _apiClient.getSession(token);
      state = AuthState.authenticated(session);
    } on AuthApiException catch (error) {
      state = AuthState.unauthenticated(errorMessage: error.message);
    }
  }

  Future<void> logout() async {
    await _tokenStore.clear();
    state = const AuthState.unauthenticated();
  }
}
