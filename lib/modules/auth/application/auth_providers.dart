import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';

import '../data/auth_api_client.dart';
import '../data/auth_token_store.dart';
import '../domain/auth_session.dart';

enum AuthStatus { loading, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.errorMessage,
    this.noticeMessage,
  });

  const AuthState.loading() : this(status: AuthStatus.loading);
  const AuthState.unauthenticated({String? errorMessage})
      : this(
          status: AuthStatus.unauthenticated,
          errorMessage: errorMessage,
        );
  const AuthState.authenticated(
    AuthSession session, {
    String? noticeMessage,
  }) : this(
          status: AuthStatus.authenticated,
          session: session,
          noticeMessage: noticeMessage,
        );

  final AuthStatus status;
  final AuthSession? session;
  final String? errorMessage;
  final String? noticeMessage;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    String? errorMessage,
    bool clearErrorMessage = false,
    String? noticeMessage,
    bool clearNoticeMessage = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      errorMessage:
          clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      noticeMessage:
          clearNoticeMessage ? null : (noticeMessage ?? this.noticeMessage),
    );
  }
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
      state = AuthState.authenticated(
        session,
        noticeMessage:
            'Empresa creada correctamente. El canal de WhatsApp puede quedar pendiente de conexión mientras se termina la configuración de Evolution API.',
      );
    } on AuthApiException catch (error) {
      state = AuthState.unauthenticated(errorMessage: error.message);
    }
  }

  void clearNotice() {
    if (state.noticeMessage == null) {
      return;
    }

    state = state.copyWith(clearNoticeMessage: true);
  }

  Future<void> logout() async {
    await _tokenStore.clear();
    state = const AuthState.unauthenticated();
  }

  Future<void> updateProfile({
    required String name,
    Uint8List? avatarBytes,
    String? avatarFileName,
    String? avatarContentType,
  }) async {
    final token = await _tokenStore.read();
    if (token == null || token.trim().isEmpty) {
      await logout();
      throw const AuthApiException('Tu sesión expiró. Inicia sesión otra vez.');
    }

    final currentState = state;

    try {
      var avatarKey = currentState.session?.user.avatarKey;
      if (avatarBytes != null &&
          avatarFileName != null &&
          avatarContentType != null) {
        avatarKey = await _apiClient.uploadAvatar(
          token: token,
          bytes: avatarBytes,
          fileName: avatarFileName,
          contentType: avatarContentType,
        );
      }

      final session = await _apiClient.updateProfile(
        token: token,
        name: name,
        avatarKey: avatarKey,
      );

      state = currentState.copyWith(
        status: AuthStatus.authenticated,
        session: session,
        clearErrorMessage: true,
      );
    } on AuthApiException catch (error) {
      state = currentState.copyWith(errorMessage: error.message);
      rethrow;
    }
  }

  Future<void> updateCompany({
    required String name,
    String? phone,
    String? email,
    String? website,
    String? taxId,
    String? addressLine1,
    String? addressLine2,
    String? city,
    String? regionState,
    String? country,
    String? postalCode,
    String? description,
  }) async {
    final token = await _tokenStore.read();
    if (token == null || token.trim().isEmpty) {
      await logout();
      throw const AuthApiException('Tu sesión expiró. Inicia sesión otra vez.');
    }

    final currentState = state;

    try {
      final session = await _apiClient.updateCompany(
        token: token,
        name: name,
        phone: phone,
        email: email,
        website: website,
        taxId: taxId,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        city: city,
        regionState: regionState,
        country: country,
        postalCode: postalCode,
        description: description,
      );

      state = currentState.copyWith(
        status: AuthStatus.authenticated,
        session: session,
        clearErrorMessage: true,
      );
    } on AuthApiException catch (error) {
      state = currentState.copyWith(errorMessage: error.message);
      rethrow;
    }
  }
}
