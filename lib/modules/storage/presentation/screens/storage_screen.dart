import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class StorageScreen extends StatelessWidget {
  const StorageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          ModuleHeader(
            title: 'Almacenamiento',
            subtitle:
                'Gestor de archivos para documentos, imágenes, videos y artefactos de entrenamiento. Búsqueda, vista previa, eliminación y políticas de retención.',
          ),
          SizedBox(height: 14),
          ExecutiveGlassCard(
            child: SizedBox(
              height: 320,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Espacio de almacenamiento\n\nEste módulo mostrará carpetas, listas de archivos y políticas de ciclo de vida (aislado por tenant).',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
