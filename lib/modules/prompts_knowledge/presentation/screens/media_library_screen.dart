import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class MediaLibraryScreen extends StatelessWidget {
  const MediaLibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ModuleHeader(
            title: 'Biblioteca multimedia',
            subtitle:
                'Administra imágenes, videos y fotos de productos usados por el bot en todos los canales.',
          ),
          const SizedBox(height: 14),
          const ExecutiveGlassCard(
            child: SizedBox(
              height: 260,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Sube multimedia y adjúntala a entradas de conocimiento o salidas de herramientas.\n\nEste módulo mostrará miniaturas, etiquetas y analítica de uso.',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
