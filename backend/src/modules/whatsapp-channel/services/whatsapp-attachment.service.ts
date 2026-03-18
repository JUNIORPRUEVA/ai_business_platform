import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import { WhatsappAttachmentEntity } from '../entities/whatsapp-attachment.entity';

@Injectable()
export class WhatsappAttachmentService {
  constructor(
    @InjectRepository(WhatsappAttachmentEntity)
    private readonly attachmentsRepository: Repository<WhatsappAttachmentEntity>,
    private readonly storageService: StorageService,
  ) {}

  async uploadManual(params: {
    companyId: string;
    buffer: Buffer;
    originalName: string;
    mimeType?: string;
    fileType: string;
  }): Promise<WhatsappAttachmentEntity> {
    if (!params.buffer.length) {
      throw new BadRequestException('El archivo esta vacio.');
    }

    const uploaded = await this.storageService.uploadBuffer({
      companyId: params.companyId,
      folder: 'media',
      filename: params.originalName,
      contentType: params.mimeType,
      buffer: params.buffer,
    });

    const entity = this.attachmentsRepository.create({
      companyId: params.companyId,
      messageId: null,
      fileType: params.fileType,
      mimeType: params.mimeType ?? null,
      originalName: params.originalName,
      storagePath: uploaded.key,
      publicUrl: null,
      sizeBytes: String(params.buffer.length),
      metadataJson: {},
    });

    return this.attachmentsRepository.save(entity);
  }

  async bindToMessage(attachmentId: string, messageId: string): Promise<void> {
    await this.attachmentsRepository.update({ id: attachmentId }, { messageId });
  }

  async downloadRemoteToStorage(params: {
    companyId: string;
    messageId: string;
    fileType: string;
    mimeType?: string | null;
    originalName: string;
    sourceUrl: string;
    metadataJson?: Record<string, unknown>;
  }): Promise<WhatsappAttachmentEntity | null> {
    try {
      const response = await fetch(params.sourceUrl);
      if (!response.ok) {
        return null;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      const uploaded = await this.storageService.uploadBuffer({
        companyId: params.companyId,
        folder: 'media',
        filename: params.originalName,
        contentType: params.mimeType ?? undefined,
        buffer: bytes,
      });

      const entity = this.attachmentsRepository.create({
        companyId: params.companyId,
        messageId: params.messageId,
        fileType: params.fileType,
        mimeType: params.mimeType ?? null,
        originalName: params.originalName,
        storagePath: uploaded.key,
        publicUrl: null,
        sizeBytes: String(bytes.length),
        metadataJson: params.metadataJson ?? {},
      });

      return this.attachmentsRepository.save(entity);
    } catch {
      return null;
    }
  }

  async getDownload(companyId: string, attachmentId: string): Promise<{ id: string; key: string; url: string }> {
    const entity = await this.attachmentsRepository.findOne({ where: { id: attachmentId, companyId } });
    if (!entity) {
      throw new NotFoundException('Adjunto no encontrado.');
    }

    const signed = await this.storageService.presignDownload({
      companyId,
      key: entity.storagePath,
    });

    return {
      id: entity.id,
      key: entity.storagePath,
      url: signed.url,
    };
  }

  async getById(companyId: string, attachmentId: string): Promise<WhatsappAttachmentEntity> {
    const entity = await this.attachmentsRepository.findOne({ where: { id: attachmentId, companyId } });
    if (!entity) {
      throw new NotFoundException('Adjunto no encontrado.');
    }
    return entity;
  }
}