import 'package:flutter/material.dart';

import '../../../shared/presentation/widgets/module_header.dart';
import '../../../../features/executive_layout/presentation/widgets/executive_content_container.dart';

class AnalyticsScreen extends StatelessWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          ModuleHeader(
            title: 'Analítica',
            subtitle:
                'Rendimiento del bot: volumen de conversaciones, tiempo de respuesta, uso de IA, ventas generadas y mix de canales.',
          ),
          SizedBox(height: 14),
          ExecutiveGlassCard(
            child: SizedBox(
              height: 320,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Panel de analítica\n\nConecta gráficas y exportaciones aquí (por tenant). Vistas sugeridas: volumen en el tiempo, SLA, tasa de takeover, llamadas a herramientas y costo por conversación.',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
