import 'dart:typed_data';

enum BotMessageAuthor {
  contact,
  bot,
  operator,
  system,
}

enum BotMessageState {
  queued,
  sent,
  delivered,
  read,
  failed,
}

enum BotMessageType {
  text,
  image,
  video,
  audio,
  document,
  system,
  unknown,
}

class BotMessage {
  const BotMessage({
    required this.id,
    required this.conversationId,
    required this.author,
    required this.body,
    required this.type,
    required this.timestamp,
    required this.state,
    this.caption,
    this.mediaUrl,
    this.thumbnailUrl,
    this.mimeType,
    this.fileName,
    this.durationSeconds,
    this.localPreviewBytes,
    this.localFileBytes,
  });

  final String id;
  final String conversationId;
  final BotMessageAuthor author;
  final String body;
  final BotMessageType type;
  final DateTime timestamp;
  final BotMessageState state;
  final String? caption;
  final String? mediaUrl;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? fileName;
  final int? durationSeconds;
  final Uint8List? localPreviewBytes;
  final Uint8List? localFileBytes;

  bool get isIncoming => author == BotMessageAuthor.contact;

  bool get isImage => type == BotMessageType.image;

  bool get isVideo => type == BotMessageType.video;

  bool get isAudio => type == BotMessageType.audio;

  bool get hasVisualMedia => isImage || isVideo;

  bool get hasDownloadableAsset => hasVisualMedia || isAudio;

  bool get canRetry =>
      state == BotMessageState.failed &&
      author == BotMessageAuthor.operator &&
      localFileBytes != null;

  BotMessage copyWith({
    String? id,
    String? conversationId,
    BotMessageAuthor? author,
    String? body,
    BotMessageType? type,
    DateTime? timestamp,
    BotMessageState? state,
    String? caption,
    String? mediaUrl,
    String? thumbnailUrl,
    String? mimeType,
    String? fileName,
    int? durationSeconds,
    Uint8List? localPreviewBytes,
    Uint8List? localFileBytes,
    bool clearLocalPreviewBytes = false,
    bool clearLocalFileBytes = false,
  }) {
    return BotMessage(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      author: author ?? this.author,
      body: body ?? this.body,
      type: type ?? this.type,
      timestamp: timestamp ?? this.timestamp,
      state: state ?? this.state,
      caption: caption ?? this.caption,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      mimeType: mimeType ?? this.mimeType,
      fileName: fileName ?? this.fileName,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      localPreviewBytes: clearLocalPreviewBytes
          ? null
          : (localPreviewBytes ?? this.localPreviewBytes),
      localFileBytes:
          clearLocalFileBytes ? null : (localFileBytes ?? this.localFileBytes),
    );
  }
}
