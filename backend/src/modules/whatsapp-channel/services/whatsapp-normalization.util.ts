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
