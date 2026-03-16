import '../../domain/entities/bot_contact_context.dart';
import 'bot_center_model_parsers.dart';

class BotProductKnowledgeModel {
  const BotProductKnowledgeModel({
    required this.name,
    required this.summary,
    required this.keyCapabilities,
    required this.qualificationSignals,
    required this.cautionPoints,
  });

  factory BotProductKnowledgeModel.fromJson(Map<String, dynamic> json) {
    return BotProductKnowledgeModel(
      name: parseString(json['name']),
      summary: parseString(json['summary']),
      keyCapabilities: parseStringList(json['keyCapabilities']),
      qualificationSignals: parseStringList(json['qualificationSignals']),
      cautionPoints: parseStringList(json['cautionPoints']),
    );
  }

  final String name;
  final String summary;
  final List<String> keyCapabilities;
  final List<String> qualificationSignals;
  final List<String> cautionPoints;

  BotProductKnowledge toEntity() {
    return BotProductKnowledge(
      name: name,
      summary: summary,
      keyCapabilities: keyCapabilities,
      qualificationSignals: qualificationSignals,
      cautionPoints: cautionPoints,
    );
  }
}

class BotContactContextModel {
  const BotContactContextModel({
    required this.customerName,
    required this.phone,
    required this.role,
    required this.businessType,
    required this.city,
    required this.tags,
    required this.productKnowledge,
  });

  factory BotContactContextModel.fromJson(Map<String, dynamic> json) {
    return BotContactContextModel(
      customerName: parseString(json['customerName']),
      phone: parseString(json['phone']),
      role: parseString(json['role']),
      businessType: parseString(json['businessType']),
      city: parseString(json['city']),
      tags: parseStringList(json['tags']),
      productKnowledge:
          ((json['productKnowledge'] as List?) ?? const <dynamic>[])
              .whereType<Map>()
              .map((item) => BotProductKnowledgeModel.fromJson(
                  Map<String, dynamic>.from(item)))
              .toList(growable: false),
    );
  }

  final String customerName;
  final String phone;
  final String role;
  final String businessType;
  final String city;
  final List<String> tags;
  final List<BotProductKnowledgeModel> productKnowledge;

  BotContactContext toEntity() {
    return BotContactContext(
      name: customerName,
      phoneNumber: phone,
      role: role,
      businessType: businessType,
      city: city,
      tags: tags,
      productKnowledge: productKnowledge
          .map((item) => item.toEntity())
          .toList(growable: false),
    );
  }
}
