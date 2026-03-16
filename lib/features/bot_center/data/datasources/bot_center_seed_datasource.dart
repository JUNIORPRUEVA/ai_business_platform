import '../models/bot_center_overview_model.dart';
import '../models/bot_contact_context_model.dart';
import '../models/bot_conversation_model.dart';
import '../models/bot_log_model.dart';
import '../models/bot_memory_item_model.dart';
import '../models/bot_message_model.dart';
import '../models/bot_prompt_config_model.dart';
import '../models/bot_status_model.dart';
import '../models/bot_test_message_result_model.dart';
import '../models/bot_tool_model.dart';

class BotCenterSeedDataSource {
  BotCenterSeedDataSource() : _store = _SeedStore.create();

  final _SeedStore _store;

  Future<BotCenterOverviewModel> getOverview({String? conversationId}) async {
    return BotCenterOverviewModel.fromJson(
        _store.buildOverviewJson(conversationId: conversationId));
  }

  Future<List<BotConversationModel>> getConversations() async {
    return _store.conversations
        .map(BotConversationModel.fromJson)
        .toList(growable: false);
  }

  Future<List<BotMessageModel>> getMessages(String conversationId) async {
    return _store.messagesByConversation[conversationId]
            ?.map(BotMessageModel.fromJson)
            .toList(growable: false) ??
        const <BotMessageModel>[];
  }

  Future<BotContactContextModel> getContactContext(
      String conversationId) async {
    final context =
        _store.contextByConversation[conversationId] ?? _store.emptyContext;
    return BotContactContextModel.fromJson(context);
  }

  Future<BotMemoryCollectionModel> getMemory(String conversationId) async {
    return BotMemoryCollectionModel.fromJson(
      _store.memoryByConversation[conversationId] ?? _store.emptyMemory,
    );
  }

  Future<List<BotToolModel>> getTools() async {
    return _store.tools.map(BotToolModel.fromJson).toList(growable: false);
  }

  Future<List<BotLogModel>> getLogs() async {
    return _store.logs.map(BotLogModel.fromJson).toList(growable: false);
  }

  Future<BotStatusModel> getStatus() async {
    return BotStatusModel.fromJson(_store.status);
  }

  Future<BotPromptConfigModel> getPrompt() async {
    return BotPromptConfigModel.fromJson(_store.prompt);
  }

  Future<BotPromptConfigModel> updatePrompt({
    String? title,
    String? description,
    required String content,
  }) async {
    _store.prompt = {
      ..._store.prompt,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      'content': content,
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
    };
    _store.logs.insert(0, {
      'id': 'log-prompt-${DateTime.now().microsecondsSinceEpoch}',
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'eventType': 'Prompt updated',
      'summary':
          'Prompt configuration was updated through the Flutter admin UI.',
      'severity': 'info',
    });

    return BotPromptConfigModel.fromJson(_store.prompt);
  }

  Future<BotTestMessageResultModel> sendTestMessage({
    required String conversationId,
    required String message,
  }) async {
    final now = DateTime.now().toUtc();
    _store.messagesByConversation
        .putIfAbsent(conversationId, () => <Map<String, dynamic>>[])
        .add({
      'id': 'msg-${now.microsecondsSinceEpoch}',
      'conversationId': conversationId,
      'author': 'operator',
      'body': message,
      'timestamp': now.toIso8601String(),
      'state': 'queued',
    });

    final conversationIndex =
        _store.conversations.indexWhere((item) => item['id'] == conversationId);
    if (conversationIndex != -1) {
      _store.conversations[conversationIndex] = {
        ..._store.conversations[conversationIndex],
        'lastMessagePreview': message,
        'timestamp': now.toIso8601String(),
        'unreadCount': 0,
      };
    }

    _store.logs.insert(0, {
      'id': 'log-msg-${now.microsecondsSinceEpoch}',
      'timestamp': now.toIso8601String(),
      'eventType': 'Test message accepted',
      'summary':
          'Placeholder outbound test message accepted for dispatch simulation.',
      'severity': 'warning',
      'conversationId': conversationId,
    });

    return BotTestMessageResultModel.fromJson({
      'success': true,
      'message':
          'Test message accepted for placeholder dispatch. No external channel was invoked.',
      'dispatchedAt': now.toIso8601String(),
      'status': 'accepted',
    });
  }
}

class _SeedStore {
  _SeedStore({
    required this.conversations,
    required this.messagesByConversation,
    required this.contextByConversation,
    required this.memoryByConversation,
    required this.tools,
    required this.logs,
    required this.status,
    required this.prompt,
  });

  factory _SeedStore.create() {
    final now = DateTime.now().toUtc();

    String minutesAgo(int minutes) =>
        now.subtract(Duration(minutes: minutes)).toIso8601String();
    String hoursAgo(int hours, {int minutes = 0}) => now
        .subtract(Duration(hours: hours, minutes: minutes))
        .toIso8601String();
    String daysAgo(int days, {int hours = 0}) =>
        now.subtract(Duration(days: days, hours: hours)).toIso8601String();

    final conversations = <Map<String, dynamic>>[
      {
        'id': 'conv-001',
        'contactName': 'Marina Costa',
        'phone': '+55 11 99871-2010',
        'lastMessagePreview':
            '¿El bot puede enviar recordatorios de pago fuera del horario laboral?',
        'unreadCount': 3,
        'stage': 'negotiation',
        'timestamp': minutesAgo(6),
      },
      {
        'id': 'conv-002',
        'contactName': 'Felipe Andrade',
        'phone': '+55 21 99415-8802',
        'lastMessagePreview':
          'Necesitamos que las reglas de memoria se alineen con las operaciones de franquicia.',
        'unreadCount': 0,
        'stage': 'qualified',
        'timestamp': minutesAgo(18),
      },
      {
        'id': 'conv-003',
        'contactName': 'Bianca Sales',
        'phone': '+55 31 98654-1107',
        'lastMessagePreview':
          'Por favor, escala este lead a un operador humano esta tarde.',
        'unreadCount': 1,
        'stage': 'escalated',
        'timestamp': hoursAgo(2),
      },
      {
        'id': 'conv-004',
        'contactName': 'Rafael Moura',
        'phone': '+55 41 99740-1243',
        'lastMessagePreview':
          'El flujo de incorporación del cliente fue aprobado por el equipo de operaciones.',
        'unreadCount': 0,
        'stage': 'onboarding',
        'timestamp': hoursAgo(7),
      },
      {
        'id': 'conv-005',
        'contactName': 'Camila Nunes',
        'phone': '+55 62 99811-3321',
        'lastMessagePreview':
            '¿Podemos probar un prompt de respaldo para un CPF con formato inválido?',
        'unreadCount': 2,
        'stage': 'follow_up',
        'timestamp': daysAgo(1, hours: 1),
      },
    ];

    final messagesByConversation = <String, List<Map<String, dynamic>>>{
      'conv-001': [
        {
          'id': 'm-001',
          'conversationId': 'conv-001',
          'author': 'contact',
          'body':
              'Queremos que FULLPOS Bot maneje recordatorios de pago atrasados sin sonar robótico.',
          'timestamp': minutesAgo(29),
          'state': 'read',
        },
        {
          'id': 'm-002',
          'conversationId': 'conv-001',
          'author': 'bot',
          'body':
              'Entendido. Puedo usar el estado de la cuenta, la fecha de vencimiento y las guías de tono aprobadas antes de enviar.',
          'timestamp': minutesAgo(24),
          'state': 'read',
        },
        {
          'id': 'm-003',
          'conversationId': 'conv-001',
          'author': 'contact',
            'body':
              '¿El bot puede enviar recordatorios de pago fuera del horario laboral?',
          'timestamp': minutesAgo(6),
          'state': 'read',
        },
      ],
      'conv-002': [
        {
          'id': 'm-004',
          'conversationId': 'conv-002',
          'author': 'operator',
          'body':
              'Podemos segmentar operadores de franquicia por región y modelo de operación de la tienda.',
          'timestamp': minutesAgo(42),
          'state': 'delivered',
        },
        {
          'id': 'm-005',
          'conversationId': 'conv-002',
          'author': 'contact',
            'body':
              'Necesitamos que las reglas de memoria se alineen con las operaciones de franquicia.',
          'timestamp': minutesAgo(18),
          'state': 'read',
        },
      ],
      'conv-003': [
        {
          'id': 'm-006',
          'conversationId': 'conv-003',
          'author': 'contact',
          'body':
              'Por favor, escala este lead a un operador humano esta tarde.',
          'timestamp': hoursAgo(2, minutes: 5),
          'state': 'read',
        },
        {
          'id': 'm-007',
          'conversationId': 'conv-003',
          'author': 'bot',
          'body':
              'Regla de escalado confirmada. Estoy encaminando la conversación y preservando el contexto actual.',
          'timestamp': hoursAgo(2),
          'state': 'read',
        },
      ],
      'conv-004': [
        {
          'id': 'm-008',
          'conversationId': 'conv-004',
          'author': 'contact',
          'body':
              'El flujo de incorporación del cliente fue aprobado por el equipo de operaciones.',
          'timestamp': hoursAgo(7, minutes: 12),
          'state': 'read',
        },
      ],
      'conv-005': [
        {
          'id': 'm-009',
          'conversationId': 'conv-005',
          'author': 'contact',
            'body':
              '¿Podemos probar un prompt de respaldo para un CPF con formato inválido?',
          'timestamp': daysAgo(1, hours: 1),
          'state': 'read',
        },
      ],
    };

    final contextByConversation = <String, Map<String, dynamic>>{
      'conv-001': {
        'customerName': 'Marina Costa',
        'phone': '+55 11 99871-2010',
        'role': 'Coordinadora de finanzas',
        'businessType': 'Cadena minorista',
        'city': 'São Paulo',
        'tags': [
          'Cuenta VIP',
          'Líder de finanzas',
          'Requiere política fuera de horario',
        ],
        'productKnowledge': [
          {
            'name': 'FULLPOS Collections Assistant',
            'summary':
                'Automatiza flujos de recordatorio de pago con control de tono, conciencia de vencimiento y umbrales de escalado seguros.',
            'keyCapabilities': [
              'Programar secuencias de recordatorio por fecha de vencimiento',
              'Ajustar el tono por segmento de cuenta',
              'Derivar disputas por encima de umbrales aprobados',
            ],
            'qualificationSignals': [
              'Necesita recordatorios de cobro fuera de horario',
              'Quiere un tono de cobro menos robótico',
              'Requiere reglas de escalado seguras para finanzas',
            ],
            'cautionPoints': [
              'No prometer descuentos sin aprobación de política',
              'Saldos en disputa deben escalar a finanzas',
            ],
          },
        ],
      },
      'conv-002': {
        'customerName': 'Felipe Andrade',
        'phone': '+55 21 99415-8802',
        'role': 'Director de operaciones',
        'businessType': 'Red de franquicias',
        'city': 'Rio de Janeiro',
        'tags': ['Franquicia', 'Revisión de memoria', 'Operaciones regionales'],
        'productKnowledge': [
          {
            'name': 'FULLPOS Franchise Memory Layer',
            'summary':
                'Conserva el contexto operativo por grupo de tienda, perfil del propietario y restricciones regionales del flujo de trabajo.',
            'keyCapabilities': [
              'Guardar el modelo operativo regional por franquicia',
              'Mantener el perfil del propietario en memoria de largo plazo',
              'Soportar políticas de calificación segmentadas',
            ],
            'qualificationSignals': [
              'Operación de franquicia multi-tienda',
              'Necesita comportamiento de memoria por región',
              'Requiere revisión de prompt liderada por operaciones',
            ],
            'cautionPoints': [
              'No consolidar todas las tiendas en un perfil genérico',
              'Cambios de prompt que afecten la calificación requieren aprobación',
            ],
          },
        ],
      },
      'conv-003': {
        'customerName': 'Bianca Sales',
        'phone': '+55 31 98654-1107',
        'role': 'Gerente comercial',
        'businessType': 'Servicios B2B',
        'city': 'Belo Horizonte',
        'tags': ['Escalado', 'Alta intención', 'Traspaso humano'],
        'productKnowledge': [
          {
            'name': 'FULLPOS Enterprise Bot Orchestrator',
            'summary':
                'Capa central de decisión que clasifica la intención, carga memoria, decide uso de herramientas y escala cuando la confianza es baja.',
            'keyCapabilities': [
              'Clasificación de rol e intención',
              'Planificación de respuestas con memoria',
              'Enrutamiento de traspaso humano para casos sensibles',
            ],
            'qualificationSignals': [
              'Necesita escalado humano el mismo día',
              'Requiere manejo seguro para precios estratégicos',
              'Quiere preservar el contexto durante la transferencia',
            ],
            'cautionPoints': [
              'Precios estratégicos no deben cerrarse automáticamente sin revisión humana',
            ],
          },
        ],
      },
      'conv-004': {
        'customerName': 'Rafael Moura',
        'phone': '+55 41 99740-1243',
        'role': 'Líder de implementación',
        'businessType': 'SaaS empresarial',
        'city': 'Curitiba',
        'tags': ['Incorporación', 'Aprobado por operaciones'],
        'productKnowledge': [
          {
            'name': 'FULLPOS Guided Onboarding Flows',
            'summary':
                'Soporta despliegue por fases, activación por checklist y hitos de capacitación de operadores para implementaciones empresariales.',
            'keyCapabilities': [
              'Incorporación por fases por grupo de tiendas',
              'Seguimiento de hitos de aprobación del piloto',
              'Adjuntar checklist de despliegue por fase',
            ],
            'qualificationSignals': [
              'El equipo de implementación ya aprobó el piloto',
              'Necesita un checklist explícito de despliegue',
            ],
            'cautionPoints': [
              'No marcar el despliegue como completo antes de confirmar la capacitación del operador',
            ],
          },
        ],
      },
      'conv-005': {
        'customerName': 'Camila Nunes',
        'phone': '+55 62 99811-3321',
        'role': 'Supervisora de soporte',
        'businessType': 'Red de salud',
        'city': 'Goiania',
        'tags': ['Ajuste de prompt', 'Flujo de validación'],
        'productKnowledge': [
          {
            'name': 'FULLPOS Validation Guardrails',
            'summary':
                'Controla flujos de respaldo de validación de CPF e identidad con reintentos seguros para auditoría.',
            'keyCapabilities': [
              'Reintentar validación sin reiniciar todo el flujo',
              'Mantener auditabilidad en ramas sensibles',
              'Usar prompts de respaldo conservadores en segmentos regulados',
            ],
            'qualificationSignals': [
              'Necesita manejo de respaldo específico para CPF',
              'Trabaja en un entorno de salud regulado',
            ],
            'cautionPoints': [
              'No solicitar datos sensibles innecesarios',
              'Los reintentos de validación deben ser explícitos y trazables',
            ],
          },
        ],
      },
    };

    final memoryByConversation = <String, Map<String, dynamic>>{
      'conv-001': {
        'shortTerm': [
          {
            'id': 'mem-001',
            'title': 'Objetivo inmediato',
            'content':
                'Validar flujos conformes de recordatorios de pago atrasados para WhatsApp.',
            'type': 'shortTerm',
            'updatedAt': minutesAgo(8),
          },
        ],
        'longTerm': [
          {
            'id': 'mem-002',
            'title': 'Política del cliente',
            'content':
                'El tono debe mantenerse consultivo y evitar lenguaje de cobro agresivo.',
            'type': 'longTerm',
            'updatedAt': hoursAgo(5),
          },
        ],
        'operational': [
          {
            'id': 'mem-003',
            'title': 'Regla operativa',
            'content':
                'Escalar cualquier disputa de facturación por encima de R\$10.000 a operaciones financieras.',
            'type': 'operational',
            'updatedAt': hoursAgo(1),
          },
        ],
      },
      'conv-002': {
        'shortTerm': [
          {
            'id': 'mem-004',
            'title': 'Segmentación regional',
            'content':
                'Las tiendas de franquicia deben agruparse por clúster de ciudades antes del contacto.',
            'type': 'shortTerm',
            'updatedAt': minutesAgo(22),
          },
        ],
        'longTerm': [
          {
            'id': 'mem-005',
            'title': 'Contexto de franquicia',
            'content':
                'El equipo de operaciones quiere que la memoria preserve el modelo de tienda y el perfil del propietario de la franquicia.',
            'type': 'longTerm',
            'updatedAt': daysAgo(3),
          },
        ],
        'operational': [
          {
            'id': 'mem-006',
            'title': 'Punto de revisión',
            'content':
                'Cualquier cambio de prompt que afecte la calificación debe ser revisado por liderazgo de operaciones.',
            'type': 'operational',
            'updatedAt': hoursAgo(9),
          },
        ],
      },
      'conv-003': {
        'shortTerm': [
          {
            'id': 'mem-007',
            'title': 'Resumen de escalado',
            'content':
                'La revisión de precios estratégicos debe pasar hoy a un especialista comercial.',
            'type': 'shortTerm',
            'updatedAt': hoursAgo(2),
          },
        ],
        'longTerm': [],
        'operational': [
          {
            'id': 'mem-008',
            'title': 'Nota de escalado',
            'content':
                'Bianca solicitó seguimiento humano el mismo día para la revisión de precios estratégicos.',
            'type': 'operational',
            'updatedAt': hoursAgo(2),
          },
        ],
      },
      'conv-004': {
        'shortTerm': [
          {
            'id': 'mem-009',
            'title': 'Hito de incorporación',
            'content':
                'El cliente aprobó el flujo piloto y solicitó el checklist de despliegue.',
            'type': 'shortTerm',
            'updatedAt': hoursAgo(7),
          },
        ],
        'longTerm': [
          {
            'id': 'mem-010',
            'title': 'Perfil de implementación',
            'content':
                'Requiere despliegue por fases por grupo de tiendas con capacitación explícita de operadores.',
            'type': 'longTerm',
            'updatedAt': daysAgo(5),
          },
        ],
        'operational': [],
      },
      'conv-005': {
        'shortTerm': [],
        'longTerm': [
          {
            'id': 'mem-011',
            'title': 'Incidencia de validación',
            'content':
                'El prompt de respaldo de CPF debe solicitar solo los dígitos faltantes, sin reiniciar todo el flujo.',
            'type': 'longTerm',
            'updatedAt': daysAgo(1),
          },
        ],
        'operational': [
          {
            'id': 'mem-012',
            'title': 'Nota de cumplimiento',
            'content':
                'Clientes de salud requieren reintentos de validación conservadores y auditabilidad explícita.',
            'type': 'operational',
            'updatedAt': daysAgo(2),
          },
        ],
      },
    };

    return _SeedStore(
      conversations: conversations,
      messagesByConversation: messagesByConversation,
      contextByConversation: contextByConversation,
      memoryByConversation: memoryByConversation,
      tools: [
        {
          'id': 'tool-001',
          'name': 'Consulta de CRM',
          'description':
              'Consulta propietario del cliente, nivel de cuenta y gerente de cuenta.',
          'category': 'Datos del cliente',
          'active': true,
        },
        {
          'id': 'tool-002',
          'name': 'Estado de facturación',
          'description':
              'Verifica estado de facturas, rangos de atraso y banderas de política de cobro.',
          'category': 'Finanzas',
          'active': true,
        },
        {
          'id': 'tool-003',
          'name': 'Búsqueda en base de conocimiento',
          'description':
              'Recupera respuestas procedimentales de documentación empresarial aprobada.',
          'category': 'Conocimiento',
          'active': true,
        },
        {
          'id': 'tool-004',
          'name': 'Traspaso a humano',
          'description':
              'Abre una ruta de escalado de soporte preservando contexto y resumen.',
          'category': 'Operaciones',
          'active': false,
        },
      ],
      logs: [
        {
          'id': 'log-001',
          'timestamp': minutesAgo(5),
          'eventType': 'Mensaje clasificado',
          'summary':
              'Intención clasificada como billing_reminder_policy con alta confianza.',
          'severity': 'info',
          'conversationId': 'conv-001',
        },
        {
          'id': 'log-002',
          'timestamp': minutesAgo(10),
          'eventType': 'Memoria actualizada',
          'summary':
              'Memoria de corto plazo actualizada con la restricción de recordatorios fuera de horario.',
          'severity': 'info',
          'conversationId': 'conv-001',
        },
        {
          'id': 'log-003',
          'timestamp': minutesAgo(21),
          'eventType': 'Revisión de prompt',
          'summary':
              'El operador revisó la rama del prompt usada para calificación de franquicia.',
          'severity': 'warning',
          'conversationId': 'conv-002',
        },
        {
          'id': 'log-004',
          'timestamp': hoursAgo(2),
          'eventType': 'Escalado creado',
          'summary':
              'Se solicitó un traspaso humano y se encaminó a operaciones comerciales.',
          'severity': 'critical',
          'conversationId': 'conv-003',
        },
        {
          'id': 'log-005',
          'timestamp': minutesAgo(2),
          'eventType': 'Chequeo de salud',
          'summary':
              'WhatsApp, runtime de IA y dependencias backend respondieron correctamente.',
          'severity': 'info',
        },
      ],
      status: {
        'connectedChannel': {
          'label': 'Canal conectado',
          'value': 'WhatsApp Business',
          'description': 'El canal principal de entrada y salida está activo.',
          'state': 'healthy',
        },
        'aiStatus': {
          'label': 'Estado de IA',
          'value': 'Inferencia lista',
          'description': 'El gateway principal del LLM responde dentro del SLA.',
          'state': 'healthy',
        },
        'backendStatus': {
          'label': 'Estado del backend',
          'value': 'Reintento degradado',
          'description':
              'Se detectaron dos picos de reintentos en el orquestador de flujos.',
          'state': 'degraded',
        },
        'databaseStatus': {
          'label': 'Estado de base de datos',
          'value': 'PostgreSQL listo',
          'description':
              'Los contratos de persistencia están listos para integrar el repositorio.',
          'state': 'healthy',
        },
        'memoryStatus': {
          'label': 'Estado de memoria',
          'value': 'Redis pendiente',
          'description':
              'Usando datos semilla gestionados por el repositorio hasta conectar Redis.',
          'state': 'degraded',
        },
      },
      prompt: {
        'id': 'prompt-001',
        'title': 'Prompt de calificación de ventas',
        'description':
            'Controla la calificación empresarial, carga de memoria, reglas de escalado y selección de herramientas.',
        'content':
            'Eres FULLPOS Bot, un asistente empresarial para operaciones de WhatsApp. Siempre inspecciona el contexto del contacto actual, productKnowledge, la memoria de corto plazo, la memoria de largo plazo y las reglas operativas antes de responder. Cuando la conversación haga referencia a un producto, módulo, SKU o capacidad específica, fundamenta la respuesta en el bloque productKnowledge correspondiente y evita afirmaciones genéricas. Prioriza la precisión sobre la velocidad, nunca inventes información de facturación o contrato, escala a un operador humano cuando se excedan umbrales de política o comerciales y mantén un tono conciso, profesional y alineado con el estilo de comunicación aprobado por el cliente.',
        'updatedAt': minutesAgo(12),
      },
    );
  }

  final List<Map<String, dynamic>> conversations;
  final Map<String, List<Map<String, dynamic>>> messagesByConversation;
  final Map<String, Map<String, dynamic>> contextByConversation;
  final Map<String, Map<String, dynamic>> memoryByConversation;
  final List<Map<String, dynamic>> tools;
  final List<Map<String, dynamic>> logs;
  final Map<String, dynamic> status;
  Map<String, dynamic> prompt;

  Map<String, dynamic> get emptyContext => const {
      'customerName': 'No disponible',
        'phone': '-',
        'role': '-',
        'businessType': '-',
        'city': '-',
        'tags': <String>[],
        'productKnowledge': <Map<String, dynamic>>[],
      };

  Map<String, dynamic> get emptyMemory => const {
        'shortTerm': <Map<String, dynamic>>[],
        'longTerm': <Map<String, dynamic>>[],
        'operational': <Map<String, dynamic>>[],
      };

  Map<String, dynamic> buildOverviewJson({String? conversationId}) {
    final effectiveId = conversationId ??
        (conversations.isNotEmpty ? conversations.first['id'] as String : null);

    return {
      'conversations': conversations,
      'tools': tools,
      'logs': logs,
      'status': status,
      'prompt': prompt,
      if (effectiveId != null)
        'selectedConversation': buildSelectedConversationJson(effectiveId),
    };
  }

  Map<String, dynamic> buildSelectedConversationJson(String conversationId) {
    final conversation = conversations.firstWhere(
      (item) => item['id'] == conversationId,
      orElse: () => const <String, dynamic>{},
    );

    return {
      'conversation': conversation,
      'messages': messagesByConversation[conversationId] ??
          const <Map<String, dynamic>>[],
      'context': contextByConversation[conversationId] ?? emptyContext,
      'memory': memoryByConversation[conversationId] ?? emptyMemory,
    };
  }
}
