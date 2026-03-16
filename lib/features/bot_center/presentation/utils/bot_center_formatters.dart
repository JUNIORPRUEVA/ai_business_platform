String formatConversationTimestamp(DateTime dateTime) {
  final now = DateTime.now();
  final difference = now.difference(dateTime);

  if (difference.inDays == 0) {
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  if (difference.inDays == 1) {
    return 'Ayer';
  }

  const months = <String>[
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  return '${months[dateTime.month - 1]} ${dateTime.day}';
}

String formatRelativeTimestamp(DateTime dateTime) {
  final difference = DateTime.now().difference(dateTime);

  if (difference.inMinutes < 1) {
    return 'Ahora mismo';
  }
  if (difference.inHours < 1) {
    return 'hace ${difference.inMinutes} min';
  }
  if (difference.inDays < 1) {
    return 'hace ${difference.inHours} h';
  }
  if (difference.inDays < 7) {
    return 'hace ${difference.inDays} d';
  }
  return formatConversationTimestamp(dateTime);
}
