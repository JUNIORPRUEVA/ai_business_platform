enum BotConfigurationSection {
  general,
  evolutionApi,
  openAi,
  memory,
  orchestrator,
  prompts,
  tools,
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
        return 'OpenAI';
      case BotConfigurationSection.memory:
        return 'Memoria';
      case BotConfigurationSection.orchestrator:
        return 'Orquestador';
      case BotConfigurationSection.prompts:
        return 'Prompts';
      case BotConfigurationSection.tools:
        return 'Herramientas';
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
        return 'Enrutamiento de modelo, política de generación y acceso al runtime.';
      case BotConfigurationSection.memory:
        return 'Comportamiento de memoria de conversación y estrategia de persistencia.';
      case BotConfigurationSection.orchestrator:
        return 'Política de razonamiento, autonomía y confirmaciones de seguridad.';
      case BotConfigurationSection.prompts:
        return 'Activos de prompt usados por el “cerebro” del bot empresarial.';
      case BotConfigurationSection.tools:
        return 'Estado de activación de herramientas internas e integraciones empresariales.';
      case BotConfigurationSection.security:
        return 'Gestión de secretos, confianza de webhooks y políticas de auditoría.';
    }
  }
}
