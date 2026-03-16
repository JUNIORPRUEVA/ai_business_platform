import 'package:flutter/material.dart';

import '../../../../features/bot_center/presentation/screens/bot_center_screen.dart';

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const BotCenterModule(embedded: true);
  }
}
