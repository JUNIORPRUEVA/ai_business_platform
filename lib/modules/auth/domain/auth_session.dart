import 'package:flutter/foundation.dart';

@immutable
class AuthUser {
  const AuthUser({
    required this.userId,
    required this.companyId,
    required this.role,
    required this.email,
    required this.name,
    this.avatarKey,
    this.avatarUrl,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      userId: (json['userId'] ?? json['id']) as String,
      companyId: json['companyId'] as String,
      role: json['role'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      avatarKey: json['avatarKey'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  final String userId;
  final String companyId;
  final String role;
  final String email;
  final String name;
  final String? avatarKey;
  final String? avatarUrl;
}

@immutable
class AuthCompany {
  const AuthCompany({
    required this.id,
    required this.name,
    required this.plan,
    required this.status,
  });

  factory AuthCompany.fromJson(Map<String, dynamic> json) {
    return AuthCompany(
      id: json['id'] as String,
      name: json['name'] as String,
      plan: json['plan'] as String,
      status: json['status'] as String,
    );
  }

  final String id;
  final String name;
  final String plan;
  final String status;
}

@immutable
class AuthSession {
  const AuthSession({required this.user, required this.company});

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
      company: AuthCompany.fromJson(json['company'] as Map<String, dynamic>),
    );
  }

  final AuthUser user;
  final AuthCompany company;
}
