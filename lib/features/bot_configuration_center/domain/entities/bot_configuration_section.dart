enum BotConfigurationSection {
  general,
  evolutionApi,
  openAi,
  memory,
  orchestrator,
  prompts,
  tools,
  documents,
  security,
}

extension BotConfigurationSectionX on BotConfigurationSection {
  String get label {
    switch (this) {
      case BotConfigurationSection.general:
        return 'General';
      case BotConfigurationSection.evolutionApi:
        return 'Evolution API';
      case BotConfigurationSection.openAi:
        return 'Motor de IA';
      case BotConfigurationSection.memory:
        return 'Memoria';
      case BotConfigurationSection.orchestrator:
        return 'Orquestador';
      case BotConfigurationSection.prompts:
        return 'Prompts';
      case BotConfigurationSection.tools:
        return 'Herramientas';
      case BotConfigurationSection.documents:
        return 'Conocimiento';
      case BotConfigurationSection.security:
        return 'Seguridad';
    }
  }

  String get subtitle {
    switch (this) {
      case BotConfigurationSection.general:
        return 'Identidad, entorno y controles de activación.';
      case BotConfigurationSection.evolutionApi:
        return 'Conectividad del canal de WhatsApp y credenciales de webhook.';
      case BotConfigurationSection.openAi:
        return 'Modelo, acceso al motor y prompt técnico de respaldo.';
      case BotConfigurationSection.memory:
        return 'Comportamiento de memoria de conversación y estrategia de persistencia.';
      case BotConfigurationSection.orchestrator:
        return 'Política de razonamiento, autonomía y confirmaciones de seguridad.';
      case BotConfigurationSection.prompts:
        return 'Prompt principal y prompts de apoyo que se editan desde aquí.';
      case BotConfigurationSection.tools:
        return 'Estado de activación de herramientas internas e integraciones empresariales.';
      case BotConfigurationSection.documents:
        return 'Base de conocimiento: catálogos, políticas, fichas y activos empresariales.';
      case BotConfigurationSection.security:
        return 'Gestión de secretos, confianza de webhooks y políticas de auditoría.';
    }
  }
}
