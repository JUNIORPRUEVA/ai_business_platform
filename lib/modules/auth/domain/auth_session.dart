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
    this.phone,
    this.email,
    this.website,
    this.taxId,
    this.addressLine1,
    this.addressLine2,
    this.city,
    this.state,
    this.country,
    this.postalCode,
    this.description,
  });

  factory AuthCompany.fromJson(Map<String, dynamic> json) {
    return AuthCompany(
      id: json['id'] as String,
      name: json['name'] as String,
      plan: json['plan'] as String,
      status: json['status'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      website: json['website'] as String?,
      taxId: json['taxId'] as String?,
      addressLine1: json['addressLine1'] as String?,
      addressLine2: json['addressLine2'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      country: json['country'] as String?,
      postalCode: json['postalCode'] as String?,
      description: json['description'] as String?,
    );
  }

  final String id;
  final String name;
  final String plan;
  final String status;
  final String? phone;
  final String? email;
  final String? website;
  final String? taxId;
  final String? addressLine1;
  final String? addressLine2;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;
  final String? description;
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
