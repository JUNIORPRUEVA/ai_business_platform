import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class WhatsappSecretService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return '';
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.resolveKey(), iv);
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return '';
    }

    const [ivBase64, authTagBase64, encryptedBase64] = normalized.split('.');
    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new InternalServerErrorException('Encrypted secret format is invalid.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.resolveKey(),
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  mask(value: string): string {
    if (!value) {
      return '';
    }

    if (value.length <= 8) {
      return '${value.substring(0, 2)}****';
    }

    return '${value.substring(0, 4)}****${value.substring(value.length - 4)}';
  }

  private resolveKey(): Buffer {
    const raw =
      this.configService.get<string>('APP_ENCRYPTION_KEY') ??
      this.configService.get<string>('WHATSAPP_ENCRYPTION_KEY') ??
      this.configService.get<string>('JWT_SECRET') ??
      '';

    if (!raw.trim()) {
      throw new InternalServerErrorException(
        'APP_ENCRYPTION_KEY or WHATSAPP_ENCRYPTION_KEY must be configured.',
      );
    }

    return createHash('sha256').update(raw).digest();
  }
}