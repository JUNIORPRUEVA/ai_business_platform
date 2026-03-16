import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import 'prompt_editor_screen.dart';
import 'knowledge_base_screen.dart';
import 'media_library_screen.dart';

class PromptsKnowledgeScreen extends StatelessWidget {
  const PromptsKnowledgeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Prompts y conocimiento',
            subtitle:
                'Configura el comportamiento del sistema, personalidad y conecta fuentes de conocimiento (docs, FAQs, manuales, multimedia).',
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: TabBar(
              isScrollable: true,
              dividerColor: Colors.transparent,
              tabAlignment: TabAlignment.start,
              tabs: const [
                Tab(text: 'Editor de prompts'),
                Tab(text: 'Base de conocimiento'),
                Tab(text: 'Biblioteca multimedia'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Expanded(
            child: TabBarView(
              children: [
                PromptEditorScreen(),
                KnowledgeBaseScreen(),
                MediaLibraryScreen(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
