import '../../domain/entities/bot_service_status.dart';
import 'bot_center_model_parsers.dart';

class BotStatusCardModel {
  const BotStatusCardModel({
    required this.label,
    required this.value,
    required this.description,
    required this.state,
  });

  factory BotStatusCardModel.fromJson(Map<String, dynamic> json) {
    return BotStatusCardModel(
      label: parseString(json['label']),
      value: parseString(json['value']),
      description: parseString(json['description']),
      state: parseString(json['state']),
    );
  }

  final String label;
  final String value;
  final String description;
  final String state;

  BotServiceStatus toEntity() {
    return BotServiceStatus(
      title: label,
      value: value,
      description: description,
      isHealthy: state == 'healthy',
    );
  }
}

class BotStatusModel {
  const BotStatusModel({
    required this.connectedChannel,
    required this.aiStatus,
    required this.backendStatus,
    required this.databaseStatus,
    required this.memoryStatus,
  });

  factory BotStatusModel.fromJson(Map<String, dynamic> json) {
    return BotStatusModel(
      connectedChannel: BotStatusCardModel.fromJson(
        Map<String, dynamic>.from(
            json['connectedChannel'] as Map? ?? const <String, dynamic>{}),
      ),
      aiStatus: BotStatusCardModel.fromJson(
        Map<String, dynamic>.from(
            json['aiStatus'] as Map? ?? const <String, dynamic>{}),
      ),
      backendStatus: BotStatusCardModel.fromJson(
        Map<String, dynamic>.from(
            json['backendStatus'] as Map? ?? const <String, dynamic>{}),
      ),
      databaseStatus: BotStatusCardModel.fromJson(
        Map<String, dynamic>.from(
            json['databaseStatus'] as Map? ?? const <String, dynamic>{}),
      ),
      memoryStatus: BotStatusCardModel.fromJson(
        Map<String, dynamic>.from(
            json['memoryStatus'] as Map? ?? const <String, dynamic>{}),
      ),
    );
  }

  final BotStatusCardModel connectedChannel;
  final BotStatusCardModel aiStatus;
  final BotStatusCardModel backendStatus;
  final BotStatusCardModel databaseStatus;
  final BotStatusCardModel memoryStatus;

  List<BotServiceStatus> toEntityList() {
    return [
      connectedChannel.toEntity(),
      aiStatus.toEntity(),
      backendStatus.toEntity(),
      databaseStatus.toEntity(),
      memoryStatus.toEntity(),
    ];
  }
}
