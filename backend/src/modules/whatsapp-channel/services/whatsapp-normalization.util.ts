export const VALID_EVOLUTION_WEBHOOK_EVENTS = [
  'APPLICATION_STARTUP',
  'QRCODE_UPDATED',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'CONTACTS_UPSERT',
  'PRESENCE_UPDATE',
  'CHATS_UPSERT',
  'GROUPS_UPSERT',
  'CONNECTION_UPDATE',
] as const;

const WEBHOOK_EVENT_ALIASES: Record<string, (typeof VALID_EVOLUTION_WEBHOOK_EVENTS)[number]> = {
  APPLICATION_STARTUP: 'APPLICATION_STARTUP',
  APPLICATION_START: 'APPLICATION_STARTUP',
  APPLICATION_STARTUP_EVENT: 'APPLICATION_STARTUP',
  QRCODE_UPDATED: 'QRCODE_UPDATED',
  QR_UPDATED: 'QRCODE_UPDATED',
  QR_UPSERT: 'QRCODE_UPDATED',
  QRCODE_UPSERT: 'QRCODE_UPDATED',
  MESSAGES_UPSERT: 'MESSAGES_UPSERT',
  MESSAGES_UPDATE: 'MESSAGES_UPDATE',
  MESSAGE_RECEIPT: 'MESSAGES_UPDATE',
  MESSAGE_RECEIPTS: 'MESSAGES_UPDATE',
  MESSAGE_ACK: 'MESSAGES_UPDATE',
  MESSAGE_ACKS: 'MESSAGES_UPDATE',
  ACK: 'MESSAGES_UPDATE',
  ACK_UPDATE: 'MESSAGES_UPDATE',
  ACK_UPDATES: 'MESSAGES_UPDATE',
  MESSAGES_DELETE: 'MESSAGES_DELETE',
  CONTACTS_UPSERT: 'CONTACTS_UPSERT',
  PRESENCE_UPDATE: 'PRESENCE_UPDATE',
  CHATS_UPSERT: 'CHATS_UPSERT',
  GROUPS_UPSERT: 'GROUPS_UPSERT',
  CONNECTION_UPDATE: 'CONNECTION_UPDATE',
  CONNECTION_STATE: 'CONNECTION_UPDATE',
};

export function normalizeEvolutionWebhookEvent(event: string): string | null {
  const normalized = event.trim().replace(/\./g, '_').replace(/-/g, '_').toUpperCase();
  if (!normalized) {
    return null;
  }

  return WEBHOOK_EVENT_ALIASES[normalized] ?? null;
}

export function normalizeEvolutionWebhookEvents(events?: string[] | null): string[] {
  const source = events && events.length > 0 ? events : [...VALID_EVOLUTION_WEBHOOK_EVENTS];
  const normalized = new Set<string>();

  for (const event of source) {
    const resolved = normalizeEvolutionWebhookEvent(event);
    if (resolved) {
      normalized.add(resolved);
    }
  }

  if (normalized.size === 0) {
    return [...VALID_EVOLUTION_WEBHOOK_EVENTS];
  }

  return [...normalized];
}

export function buildEvolutionWebhookPayload(params: {
  enabled?: boolean;
  url: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[] | null;
}): {
  enabled: boolean;
  url: string;
  webhook_by_events: boolean;
  webhook_base64: boolean;
  events: string[];
} {
  return {
    enabled: params.enabled ?? true,
    url: params.url.trim(),
    webhook_by_events: params.webhookByEvents ?? true,
    webhook_base64: params.webhookBase64 ?? false,
    events: normalizeEvolutionWebhookEvents(params.events),
  };
}

export function buildEvolutionWebhookCompatPayload(params: {
  enabled?: boolean;
  url: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[] | null;
}): {
  webhook: {
    enabled: boolean;
    url: string;
    webhookByEvents: boolean;
    webhookBase64: boolean;
    events: string[];
  };
} {
  return {
    webhook: {
      enabled: params.enabled ?? true,
      url: params.url.trim(),
      webhookByEvents: params.webhookByEvents ?? true,
      webhookBase64: params.webhookBase64 ?? false,
      events: normalizeEvolutionWebhookEvents(params.events),
    },
  };
}

export function readEvolutionWebhookUrl(source: Record<string, unknown>): string {
  for (const candidate of collectEvolutionWebhookMaps(source)) {
    const direct =
      readString(candidate['url']) ||
      readString(candidate['webhookUrl']) ||
      readString(candidate['webhook_url']) ||
      readString(candidate['webhook']);
    if (direct) {
      return direct;
    }
  }

  return '';
}

export function readEvolutionWebhookEvents(source: Record<string, unknown>): string[] {
  for (const candidate of collectEvolutionWebhookMaps(source)) {
    const direct =
      readStringArray(candidate['events']) ||
      readStringArray(candidate['webhookEvents']) ||
      readStringArray(candidate['webhook_events']);
    if (direct.length > 0) {
      return normalizeEvolutionWebhookEvents(direct);
    }
  }

  return [];
}

export function normalizeComparableWebhookUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function normalizeWhatsappPhoneNumber(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  const normalized = digits.length === 10 ? `1${digits}` : digits;
  if (normalized.length < 10 || normalized.length > 15) {
    return null;
  }

  return normalized;
}

export function normalizeWhatsappJid(
  value: string,
  options?: { allowLid?: boolean; allowGroup?: boolean },
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.endsWith('@lid')) {
    return options?.allowLid ? trimmed : null;
  }

  if (trimmed.endsWith('@g.us')) {
    return options?.allowGroup ? trimmed : null;
  }

  if (trimmed.includes('@')) {
    if (!trimmed.endsWith('@s.whatsapp.net')) {
      return null;
    }

    const normalizedNumber = normalizeWhatsappPhoneNumber(trimmed.replace(/@.+$/, ''));
    return normalizedNumber ? `${normalizedNumber}@s.whatsapp.net` : null;
  }

  const normalizedNumber = normalizeWhatsappPhoneNumber(trimmed);
  return normalizedNumber ? `${normalizedNumber}@s.whatsapp.net` : null;
}

export function extractDigitsFromWhatsappJid(value: string): string {
  return value.replace(/@.+$/, '').replace(/\D/g, '');
}

function collectEvolutionWebhookMaps(source: Record<string, unknown>): Record<string, unknown>[] {
  const collected: Record<string, unknown>[] = [];
  const queue: Record<string, unknown>[] = [source];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);
    collected.push(current);

    for (const key of ['data', 'instance', 'webhookData', 'webhook_data', 'webhook']) {
      const nested = readMap(current[key]);
      if (Object.keys(nested).length > 0) {
        queue.push(nested);
      }
    }
  }

  return collected;
}

function readMap(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
