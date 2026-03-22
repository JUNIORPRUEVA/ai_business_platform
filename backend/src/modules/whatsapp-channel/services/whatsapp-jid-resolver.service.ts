import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { EvolutionApiClientService } from './evolution-api-client.service';

type JsonRecord = Record<string, unknown>;

export type CanonicalJidSource =
  | 'remote_jid'
  | 'payload'
  | 'stored_chat'
  | 'last_inbound_payload'
  | 'evolution_lookup';

export interface JidDescriptor {
  originalJid: string;
  normalizedJid: string;
  canonicalJid: string | null;
  phone: string | null;
  jidType: 'lid' | 'pn' | 'group' | 'unknown';
  isLid: boolean;
  canReply: boolean;
}

@Injectable()
export class WhatsappJidResolverService {
  private readonly logger = new Logger(WhatsappJidResolverService.name);

  constructor(private readonly evolutionApiClient: EvolutionApiClientService) {}

  normalizeRemoteJid(value: string, options?: { throwOnEmpty?: boolean }): string {
    const trimmed = value.trim();
    if (!trimmed) {
      if (options?.throwOnEmpty) {
        throw new BadRequestException('remoteJid es obligatorio.');
      }
      return '';
    }
    return trimmed.includes('@') ? trimmed : `${trimmed.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  normalizeJid(value: string, options?: { throwOnEmpty?: boolean }): string {
    return this.normalizeRemoteJid(value, options);
  }

  normalizeReplyJid(value: string, options?: { throwOnEmpty?: boolean }): string {
    const normalizedJid = this.normalizeRemoteJid(value, options);
    if (!normalizedJid) {
      return normalizedJid;
    }

    if (!normalizedJid.endsWith('@lid')) {
      return normalizedJid;
    }

    const digits = this.extractPhoneFromJid(normalizedJid);
    if (!digits) {
      if (options?.throwOnEmpty) {
        throw new BadRequestException('remoteJid no contiene digitos para responder.');
      }
      return '';
    }

    return `${digits}@s.whatsapp.net`;
  }

  describeJid(originalJid: string, canonicalJid?: string | null): JidDescriptor {
    const normalizedJid = this.normalizeRemoteJid(originalJid);
    const normalizedCanonical = this.normalizeCanonicalRemoteJid(canonicalJid);
    const phone = normalizedCanonical
      ? this.normalizeOutboundNumber(this.jidToNumber(normalizedCanonical))
      : normalizedJid.endsWith('@s.whatsapp.net')
          ? this.normalizeOutboundNumber(this.jidToNumber(normalizedJid))
          : null;

    return {
      originalJid,
      normalizedJid,
      canonicalJid: normalizedCanonical,
      phone: phone || null,
      jidType: this.detectJidType(normalizedJid),
      isLid: normalizedJid.endsWith('@lid'),
      canReply: normalizedJid.endsWith('@s.whatsapp.net') || Boolean(normalizedCanonical && phone),
    };
  }

  normalizeCanonicalRemoteJid(value?: string | null): string | null {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return null;
    }
    if (!trimmed.endsWith('@s.whatsapp.net')) {
      return null;
    }
    const digits = this.normalizeOutboundNumber(this.jidToNumber(trimmed));
    if (!digits) {
      return null;
    }
    return `${digits}@s.whatsapp.net`;
  }

  jidToNumber(jid: string): string {
    return this.extractPhoneFromJid(jid);
  }

  extractPhoneFromJid(jid: string): string {
    return jid.replace(/@.+$/, '').replace(/\D/g, '');
  }

  normalizeOutboundNumber(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    if (digits.length === 10) {
      return `1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return digits;
    }

    return digits;
  }

  detectJidType(remoteJid: string): 'lid' | 'pn' | 'group' | 'unknown' {
    if (remoteJid.endsWith('@s.whatsapp.net')) {
      return 'pn';
    }
    if (remoteJid.endsWith('@lid')) {
      return 'lid';
    }
    if (remoteJid.endsWith('@g.us')) {
      return 'group';
    }
    return 'unknown';
  }

  extractCanonicalRemoteJidFromPayload(payload: JsonRecord): string | null {
    const data = this.readMap(payload['data']);
    const key = this.readMap(data['key']);
    const message = this.readMap(data['message']);
    const remoteJid = this.readString(key['remoteJid']);
    const disallowedDigits = this.buildDisallowedDigits(remoteJid);
    const rootCandidates = [
      this.readString(payload['participant']),
      this.readString(payload['participantJid']),
      this.readString(payload['participantPn']),
      this.readString(payload['sender']),
      this.readString(payload['senderJid']),
      this.readString(payload['senderPn']),
      this.readString(payload['senderId']),
      this.readString(payload['sender_id']),
      this.readString(payload['author']),
      this.readString(payload['authorJid']),
      this.readString(payload['from']),
      this.readString(payload['fromJid']),
      this.readString(payload['fromPn']),
      this.readString(payload['phone']),
      this.readString(payload['phoneNumber']),
      this.readString(payload['wa_id']),
      this.readString(payload['waId']),
      this.readString(this.readMap(payload['source'])['participant']),
      this.readString(this.readMap(payload['source'])['participantJid']),
      this.readString(this.readMap(payload['source'])['participantPn']),
      this.readString(this.readMap(payload['source'])['sender']),
      this.readString(this.readMap(payload['source'])['senderJid']),
      this.readString(this.readMap(payload['source'])['senderPn']),
      this.readString(this.readMap(payload['source'])['phone']),
      this.readString(this.readMap(payload['source'])['phoneNumber']),
      this.readString(this.readMap(payload['source'])['wa_id']),
      this.readString(this.readMap(payload['source'])['waId']),
    ];

    for (const candidate of rootCandidates) {
      const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    return this.extractCanonicalRemoteJid(data, key, message, remoteJid);
  }

  extractCanonicalRemoteJid(
    data: JsonRecord,
    key: JsonRecord,
    message: JsonRecord,
    remoteJid: string,
  ): string | null {
    const disallowedDigits = this.buildDisallowedDigits(remoteJid);
    const candidates = [
      this.readString(key['participantJid']),
      this.readString(key['participant']),
      this.readString(key['participantPn']),
      this.readString(key['senderPn']),
      this.readString(key['sender']),
      this.readString(key['senderJid']),
      this.readString(key['from']),
      this.readString(data['participant']),
      this.readString(data['participantJid']),
      this.readString(data['sender']),
      this.readString(data['senderJid']),
      this.readString(data['participantPn']),
      this.readString(data['senderPn']),
      this.readString(data['senderId']),
      this.readString(data['sender_id']),
      this.readString(data['participantId']),
      this.readString(data['participant_id']),
      this.readString(data['author']),
      this.readString(data['authorJid']),
      this.readString(data['from']),
      this.readString(data['fromJid']),
      this.readString(data['fromPn']),
      this.readString(data['phone']),
      this.readString(data['phoneNumber']),
      this.readString(data['wa_id']),
      this.readString(data['waId']),
      this.readString(this.readMap(data['messageContextInfo'])['participant']),
      this.readString(this.readMap(data['messageContextInfo'])['participantPn']),
      this.readString(this.readMap(data['messageContextInfo'])['senderPn']),
      this.readString(this.readMap(data['messageContextInfo'])['sender']),
      this.readString(this.readMap(data['messageContextInfo'])['senderJid']),
      this.readString(this.readMap(data['source'])['participant']),
      this.readString(this.readMap(data['source'])['participantPn']),
      this.readString(this.readMap(data['source'])['sender']),
      this.readString(this.readMap(data['source'])['senderPn']),
      this.readString(this.readMap(data['source'])['senderJid']),
      this.readString(this.readMap(data['source'])['phone']),
      this.readString(this.readMap(data['source'])['phoneNumber']),
      this.readString(this.readMap(data['source'])['wa_id']),
      this.readString(this.readMap(data['source'])['waId']),
    ];

    for (const candidate of candidates) {
      const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    const contacts = data['contacts'];
    if (Array.isArray(contacts)) {
      for (const item of contacts) {
        if (typeof item !== 'object' || item == null) {
          continue;
        }
        const contact = item as JsonRecord;
        const contactCandidates = [
          this.readString(contact['id']),
          this.readString(contact['jid']),
          this.readString(contact['wa_id']),
          this.readString(contact['waId']),
          this.readString(contact['phoneNumber']),
          this.readString(contact['phone']),
          this.readString(contact['number']),
          this.readString(contact['user']),
        ];

        for (const candidate of contactCandidates) {
          const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
          if (canonical) {
            return canonical;
          }
        }
      }
    }

    const participantFromContext = (context: JsonRecord): string | null => {
      const contextCandidates = [
        this.readString(context['participant']),
        this.readString(context['participantPn']),
        this.readString(context['participantJid']),
        this.readString(context['sender']),
        this.readString(context['senderPn']),
        this.readString(context['senderJid']),
        this.readString(context['author']),
        this.readString(context['authorJid']),
        this.readString(context['phone']),
        this.readString(context['phoneNumber']),
        this.readString(context['wa_id']),
        this.readString(context['waId']),
      ];

      for (const candidate of contextCandidates) {
        const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
        if (canonical) {
          return canonical;
        }
      }

      return null;
    };

    const extended = this.readMap(message['extendedTextMessage']);
    const topContext = this.readMap(extended['contextInfo'] ?? message['contextInfo']);
    const direct = participantFromContext(topContext);
    if (direct) {
      return direct;
    }

    const mediaContexts: JsonRecord[] = [
      this.readMap(this.readMap(message['imageMessage'])['contextInfo']),
      this.readMap(this.readMap(message['videoMessage'])['contextInfo']),
      this.readMap(this.readMap(message['audioMessage'])['contextInfo']),
      this.readMap(this.readMap(message['documentMessage'])['contextInfo']),
    ];

    for (const context of mediaContexts) {
      const canonical = participantFromContext(context);
      if (canonical) {
        return canonical;
      }
    }

    const reaction = this.readMap(message['reactionMessage']);
    const reactionKey = this.readMap(reaction['key']);
    const reactionParticipant = this.resolveCanonicalCandidate(
      this.readString(reactionKey['participant']),
      disallowedDigits,
    );
    if (reactionParticipant) {
      return reactionParticipant;
    }

    return this.extractCanonicalByHeuristicScan(
      {
        data,
        key,
        message,
        source: this.readMap(data['source']),
      },
      disallowedDigits,
    );
  }

  async lookupCanonicalRemoteJidFromEvolution(
    config: WhatsappChannelConfigEntity,
    remoteJid: string,
  ): Promise<string | null> {
    const lookups: Array<{
      source: 'findContacts' | 'findChats';
      body: JsonRecord;
    }> = [
      { source: 'findContacts', body: { where: { id: remoteJid } } },
      { source: 'findContacts', body: { where: { remoteJid } } },
      { source: 'findContacts', body: { where: { jid: remoteJid } } },
      { source: 'findChats', body: { where: { id: remoteJid } } },
      { source: 'findChats', body: { where: { remoteJid } } },
      { source: 'findChats', body: { where: { jid: remoteJid } } },
    ];

    for (const lookup of lookups) {
      try {
        const response =
          lookup.source === 'findContacts'
            ? await this.evolutionApiClient.findContacts(config, lookup.body)
            : await this.evolutionApiClient.findChats(config, lookup.body);
        const canonical = this.extractCanonicalRemoteJidFromLookupResponse(response, remoteJid);
        if (canonical) {
          this.logger.log(
            `[WHATSAPP JID RESOLVER] lookup match instance=${config.instanceName} remoteJid=${remoteJid} canonicalJid=${canonical} source=${lookup.source} query=${this.stringifyForLog(lookup.body)}`,
          );
          return canonical;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'lookup_failed';
        this.logger.warn(
          `[WHATSAPP JID RESOLVER] lookup failed instance=${config.instanceName} remoteJid=${remoteJid} source=${lookup.source} query=${this.stringifyForLog(lookup.body)} error=${message}`,
        );
      }
    }

    return null;
  }

  private extractCanonicalRemoteJidFromLookupResponse(
    response: JsonRecord,
    remoteJid: string,
  ): string | null {
    const disallowedDigits = this.buildDisallowedDigits(remoteJid);
    const matchedObjects = this.collectLookupMatches(response, remoteJid);

    for (const item of matchedObjects) {
      const canonical = this.extractCanonicalFromLookupObject(item, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    return this.extractCanonicalByHeuristicScan(response, disallowedDigits);
  }

  private collectLookupMatches(value: unknown, remoteJid: string, depth = 0): JsonRecord[] {
    if (depth > 6 || value == null) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectLookupMatches(item, remoteJid, depth + 1));
    }

    if (typeof value !== 'object') {
      return [];
    }

    const map = value as JsonRecord;
    const matches: JsonRecord[] = [];
    const directCandidates = [
      this.readString(map['id']),
      this.readString(map['jid']),
      this.readString(map['remoteJid']),
      this.readString(map['remote_jid']),
      this.readString(map['lid']),
      this.readString(map['userLid']),
      this.readString(map['user_lid']),
      this.readString(this.readMap(map['key'])['remoteJid']),
    ];

    if (directCandidates.some((candidate) => candidate === remoteJid)) {
      matches.push(map);
    }

    for (const nested of Object.values(map)) {
      matches.push(...this.collectLookupMatches(nested, remoteJid, depth + 1));
    }

    return matches;
  }

  private extractCanonicalFromLookupObject(
    value: JsonRecord,
    disallowedDigits: Set<string>,
  ): string | null {
    const candidates = [
      this.readString(value['canonicalJid']),
      this.readString(value['canonical_jid']),
      this.readString(value['jid']),
      this.readString(value['contactJid']),
      this.readString(value['contact_jid']),
      this.readString(value['participantJid']),
      this.readString(value['participant_jid']),
      this.readString(value['phone']),
      this.readString(value['phoneNumber']),
      this.readString(value['number']),
      this.readString(value['wa_id']),
      this.readString(value['waId']),
      this.readString(this.readMap(value['contact'])['jid']),
      this.readString(this.readMap(value['contact'])['phone']),
      this.readString(this.readMap(value['contact'])['number']),
    ];

    for (const candidate of candidates) {
      const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    return this.extractCanonicalByHeuristicScan(value, disallowedDigits);
  }

  private extractCanonicalByHeuristicScan(
    value: unknown,
    disallowedDigits: Set<string>,
    path = '',
    depth = 0,
  ): string | null {
    if (depth > 5 || value == null) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const lastSegment = path.split('.').slice(-1)[0]?.toLowerCase() ?? '';
      if (!this.shouldInspectCanonicalPath(lastSegment)) {
        return null;
      }
      return this.resolveCanonicalCandidate(String(value), disallowedDigits);
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const nested = this.extractCanonicalByHeuristicScan(
          value[index],
          disallowedDigits,
          `${path}[${index}]`,
          depth + 1,
        );
        if (nested) {
          return nested;
        }
      }
      return null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    for (const [key, nestedValue] of Object.entries(value as JsonRecord)) {
      const nextPath = path ? `${path}.${key}` : key;
      const nested = this.extractCanonicalByHeuristicScan(
        nestedValue,
        disallowedDigits,
        nextPath,
        depth + 1,
      );
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private resolveCanonicalCandidate(value: string, disallowedDigits: Set<string> = new Set()): string | null {
    const canonicalJid = this.normalizeCanonicalRemoteJid(value);
    if (canonicalJid) {
      const canonicalDigits = this.normalizeOutboundNumber(this.jidToNumber(canonicalJid));
      if (canonicalDigits && disallowedDigits.has(canonicalDigits)) {
        return null;
      }
      return canonicalJid;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.endsWith('@lid') || trimmed.endsWith('@g.us') || trimmed.includes('@')) {
      return null;
    }

    const digits = this.normalizeOutboundNumber(trimmed.replace(/\D/g, ''));
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    if (disallowedDigits.has(digits)) {
      return null;
    }

    return `${digits}@s.whatsapp.net`;
  }

  private buildDisallowedDigits(remoteJid: string): Set<string> {
    const digits = remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
    return digits ? new Set([digits]) : new Set();
  }

  private shouldInspectCanonicalPath(segment: string): boolean {
    if (!segment) {
      return false;
    }

    const normalized = segment.replace(/\[\d+\]/g, '').toLowerCase();
    if (
      normalized.includes('remotejid') ||
      normalized.includes('messageid') ||
      normalized.includes('timestamp') ||
      normalized.includes('instanceid') ||
      normalized === 'status' ||
      normalized === 'type'
    ) {
      return false;
    }

    return normalized.includes('sender') ||
      normalized.includes('participant') ||
      normalized.includes('author') ||
      normalized.includes('contact') ||
      normalized.includes('phone') ||
      normalized.includes('number') ||
      normalized.includes('jid') ||
      normalized.includes('wa_id') ||
      normalized.includes('waid') ||
      normalized.includes('from') ||
      normalized.endsWith('pn');
  }

  private readMap(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? (value as JsonRecord) : {};
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private stringifyForLog(value: unknown): string {
    try {
      const json = JSON.stringify(value);
      if (!json) {
        return '(empty)';
      }
      return json.length > 2000 ? `${json.slice(0, 2000)}...(truncated)` : json;
    } catch {
      return '(unserializable)';
    }
  }
}
