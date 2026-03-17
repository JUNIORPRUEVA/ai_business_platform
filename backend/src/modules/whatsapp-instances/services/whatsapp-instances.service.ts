import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EvolutionService } from '../../evolution/evolution.service';
import { WhatsappInstanceEntity, WhatsappInstanceStatus } from '../entities/whatsapp-instance.entity';

@Injectable()
export class WhatsappInstancesService {
  private readonly logger = new Logger(WhatsappInstancesService.name);

  constructor(
    @InjectRepository(WhatsappInstanceEntity)
    private readonly repo: Repository<WhatsappInstanceEntity>,
    private readonly evolutionService: EvolutionService,
    private readonly configService: ConfigService,
  ) {}

  async list(tenantId: string) {
    const items = await this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    // Never expose secrets
    return items.map((i) => this.toPublic(i));
  }

  async getByInstanceName(tenantId: string, instanceName: string): Promise<WhatsappInstanceEntity> {
    const normalized = this.normalizeInstanceName(instanceName);
    const found = await this.repo.findOne({ where: { tenantId, instanceName: normalized } });
    if (!found) throw new NotFoundException('WhatsApp instance not found.');
    return found;
  }

  async createInstance(tenantId: string, instanceName: string) {
    const normalized = this.normalizeInstanceName(instanceName);

    const existing = await this.repo.findOne({ where: { instanceName: normalized } });
    if (existing) {
      // global uniqueness avoids webhook ambiguity
      if (existing.tenantId === tenantId) {
        throw new ConflictException('Instance name already exists for this tenant.');
      }
      throw new ConflictException('Instance name already exists.');
    }

    await this.evolutionService.createInstance({ instanceName: normalized, qrcode: true });

    const instanceWebhookUrl = (this.configService.get<string>('EVOLUTION_INSTANCE_WEBHOOK_URL') ?? '').trim();
    if (instanceWebhookUrl) {
      try {
        await this.evolutionService.setWebhook({
          instanceName: normalized,
          url: instanceWebhookUrl,
          events: ['connection.update', 'qr.updated', 'messages.upsert'],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Evolution webhook error.';
        this.logger.warn(`Failed to set Evolution instance webhook: ${message}`);
      }
    }

    const entity = this.repo.create({
      tenantId,
      instanceName: normalized,
      evolutionUrl: (this.configService.get<string>('EVOLUTION_API_URL') ?? '').trim() || null,
      evolutionApiKey: (this.configService.get<string>('EVOLUTION_API_KEY') ?? '').trim() || null,
      status: 'created',
      qrCode: null,
      phoneNumber: null,
      sessionData: null,
    });

    const saved = await this.repo.save(entity);
    return this.toPublic(saved);
  }

  async getQRCode(tenantId: string, instanceName: string): Promise<{ qrCode: string | null }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    const raw = await this.evolutionService.getQRCode(entity.instanceName);
    const qrCode = this.extractQrCode(raw);

    entity.qrCode = qrCode;
    if (entity.status !== 'connected') {
      entity.status = 'connecting';
    }

    await this.repo.save(entity);
    return { qrCode };
  }

  async refreshStatus(tenantId: string, instanceName: string): Promise<{ status: WhatsappInstanceStatus; phoneNumber: string | null }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    const { status: evoStatus } = await this.evolutionService.checkConnection(entity.instanceName);

    entity.status = this.mapEvolutionStatus(evoStatus);
    if (entity.status === 'connected') {
      entity.qrCode = null;
    }

    await this.repo.save(entity);
    return { status: entity.status, phoneNumber: entity.phoneNumber };
  }

  async logoutInstance(tenantId: string, instanceName: string): Promise<{ ok: true }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    await this.evolutionService.logoutInstance(entity.instanceName);

    entity.status = 'disconnected';
    entity.qrCode = null;
    entity.phoneNumber = null;
    entity.sessionData = null;

    await this.repo.save(entity);
    return { ok: true };
  }

  async updateInstance(
    tenantId: string,
    instanceName: string,
    newInstanceName: string,
  ) {
    const entity = await this.getByInstanceName(tenantId, instanceName);
    const currentName = entity.instanceName;
    const normalizedNewName = this.normalizeInstanceName(newInstanceName);

    if (currentName === normalizedNewName) {
      return this.toPublic(entity);
    }

    if (entity.status === 'connected') {
      throw new ConflictException(
        'No puedes editar el nombre de una instancia conectada. Desconéctala o elimínala primero.',
      );
    }

    const existing = await this.repo.findOne({ where: { instanceName: normalizedNewName } });
    if (existing) {
      if (existing.tenantId === tenantId) {
        throw new ConflictException('Instance name already exists for this tenant.');
      }
      throw new ConflictException('Instance name already exists.');
    }

    await this.evolutionService.createInstance({
      instanceName: normalizedNewName,
      qrcode: true,
    });

    const instanceWebhookUrl =
      (this.configService.get<string>('EVOLUTION_INSTANCE_WEBHOOK_URL') ?? '').trim();
    if (instanceWebhookUrl) {
      try {
        await this.evolutionService.setWebhook({
          instanceName: normalizedNewName,
          url: instanceWebhookUrl,
          events: ['connection.update', 'qr.updated', 'messages.upsert'],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Evolution webhook error.';
        this.logger.warn(`Failed to set Evolution instance webhook for renamed instance: ${message}`);
      }
    }

    try {
      await this.evolutionService.deleteInstance(currentName);
    } catch (error) {
      try {
        await this.evolutionService.deleteInstance(normalizedNewName);
      } catch (rollbackError) {
        const rollbackMessage =
          rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error.';
        this.logger.error(`Failed to rollback replacement instance ${normalizedNewName}: ${rollbackMessage}`);
      }

      const message = error instanceof Error ? error.message : 'Unknown Evolution deletion error.';
      throw new ConflictException(
        `No se pudo reemplazar la instancia actual. ${message}`,
      );
    }

    entity.instanceName = normalizedNewName;
    entity.status = 'created';
    entity.qrCode = null;
    entity.phoneNumber = null;
    entity.sessionData = null;
    entity.evolutionUrl =
      (this.configService.get<string>('EVOLUTION_API_URL') ?? '').trim() ||
      entity.evolutionUrl;
    entity.evolutionApiKey =
      (this.configService.get<string>('EVOLUTION_API_KEY') ?? '').trim() ||
      entity.evolutionApiKey;

    const saved = await this.repo.save(entity);
    return this.toPublic(saved);
  }

  async deleteInstance(tenantId: string, instanceName: string): Promise<{ ok: true }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    await this.evolutionService.deleteInstance(entity.instanceName);
    await this.repo.remove(entity);

    return { ok: true };
  }

  async applyWebhook(payload: {
    event?: string;
    instance?: string;
    data?: Record<string, unknown>;
  }): Promise<{ updated: boolean; instanceName?: string }> {
    const instanceName = (payload.instance ?? '').trim();
    if (!instanceName) {
      throw new BadRequestException('Missing instance in webhook payload.');
    }

    const entity = await this.repo.findOne({ where: { instanceName } });
    if (!entity) {
      this.logger.warn(`Webhook received for unknown instance: ${instanceName}`);
      return { updated: false, instanceName };
    }

    const event = (payload.event ?? '').trim();
    const data = payload.data ?? {};

    if (event === 'qr.updated' || event === 'qrcode.updated') {
      const qrCode = this.extractQrCode(data);
      if (qrCode) {
        entity.qrCode = qrCode;
        if (entity.status !== 'connected') entity.status = 'connecting';
      }
      await this.repo.save(entity);
      return { updated: true, instanceName };
    }

    if (event === 'connection.update' || event === 'connection.state') {
      const next = this.guessStatusFromWebhook(data);
      entity.status = next ?? entity.status;
      entity.sessionData = data;

      const phone = this.extractPhoneNumber(data);
      if (phone) entity.phoneNumber = phone;

      if (entity.status === 'connected') {
        entity.qrCode = null;
      }

      await this.repo.save(entity);
      return { updated: true, instanceName };
    }

    // For other events (e.g., messages.upsert) we currently don't persist.
    return { updated: false, instanceName };
  }

  private normalizeInstanceName(value: string): string {
    const normalized = (value ?? '').trim().replace(/\s+/g, '_');
    if (!normalized) {
      throw new BadRequestException('instanceName is required.');
    }
    return normalized;
  }

  private mapEvolutionStatus(status: 'connecting' | 'connected' | 'disconnected'): WhatsappInstanceStatus {
    return status;
  }

  private extractQrCode(raw: unknown): string | null {
    const direct = this.tryReadQrValue(raw);
    if (direct) return direct;

    // If Evolution returned a nested shape, do shallow scan.
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, unknown>;
      return (
        this.tryReadQrValue(r.qr) ||
        this.tryReadQrValue(r.qrcode) ||
        this.tryReadQrValue(r.qrCode) ||
        this.tryReadQrValue(r.base64) ||
        this.tryReadQrValue(r.data)
      );
    }

    return null;
  }

  private tryReadQrValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      if (v.startsWith('data:image/')) return v;
      // Heuristic: many base64 PNG payloads are large
      if (v.length > 100 && /^[a-zA-Z0-9+/=\r\n]+$/.test(v)) return v;
      return v;
    }

    if (typeof value === 'object' && value !== null) {
      const r = value as Record<string, unknown>;
      const candidates = [r.qr, r.qrcode, r.qrCode, r.base64, r.image];
      const match = candidates.find((c) => typeof c === 'string' && (c as string).trim());
      return match ? (match as string).trim() : null;
    }

    return null;
  }

  private guessStatusFromWebhook(data: Record<string, unknown>): WhatsappInstanceStatus | null {
    const candidates: Array<unknown> = [data.status, data.state, data.connectionStatus, data.connection, data['connection_state']];
    const raw = candidates.find((c) => typeof c === 'string') as string | undefined;
    const s = (raw ?? '').toLowerCase();

    if (!s) return null;
    if (s.includes('connect') && !s.includes('disconnect')) return 'connected';
    if (s.includes('open')) return 'connected';
    if (s.includes('connecting') || s.includes('pair')) return 'connecting';
    if (s.includes('close') || s.includes('disconnect') || s.includes('offline')) return 'disconnected';

    return null;
  }

  private extractPhoneNumber(data: Record<string, unknown>): string | null {
    const candidates: Array<unknown> = [
      data.phone_number,
      data.phoneNumber,
      data.number,
      data.user,
      data.me,
      data.id,
    ];

    for (const c of candidates) {
      const maybe = this.stringifyWhatsAppId(c);
      if (maybe) return maybe;
    }

    return null;
  }

  private stringifyWhatsAppId(value: unknown): string | null {
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      // normalize '553199999999@s.whatsapp.net' -> digits
      const digits = v.replace(/\D/g, '');
      return digits.length >= 8 ? digits : v;
    }

    if (typeof value === 'object' && value !== null) {
      const r = value as Record<string, unknown>;
      if (typeof r.id === 'string') return this.stringifyWhatsAppId(r.id);
      if (typeof r.user === 'string') return this.stringifyWhatsAppId(r.user);
      if (typeof r.phone === 'string') return this.stringifyWhatsAppId(r.phone);
    }

    return null;
  }

  private toPublic(entity: WhatsappInstanceEntity) {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      instanceName: entity.instanceName,
      status: entity.status,
      qrCode: entity.qrCode,
      phoneNumber: entity.phoneNumber,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
