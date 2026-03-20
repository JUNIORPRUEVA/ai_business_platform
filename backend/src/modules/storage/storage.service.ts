import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { StorageFolder } from './dto/presign-upload.dto';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('S3_REGION') ?? 'auto';
    const endpoint = this.configService.get<string>('S3_ENDPOINT');

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY') ?? '';

    this.s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: (this.configService.get<string>('S3_FORCE_PATH_STYLE') ?? 'false') === 'true',
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  getBucket(): string {
    const bucket = this.configService.get<string>('S3_BUCKET') ?? '';
    if (!bucket) {
      throw new BadRequestException('S3_BUCKET is not configured.');
    }
    return bucket;
  }

  buildObjectKey(companyId: string, folder: StorageFolder, filename: string): string {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${companyId}/${folder}/${randomUUID()}-${safeFilename}`;
  }

  assertCompanyKeyOwnership(companyId: string, key: string): void {
    if (!key.startsWith(`${companyId}/`)) {
      throw new BadRequestException('Key does not belong to this company.');
    }
  }

  async presignUpload(params: {
    companyId: string;
    folder: StorageFolder;
    filename: string;
    contentType?: string;
    expiresInSeconds?: number;
  }): Promise<{ key: string; url: string; expiresInSeconds: number }> {
    const key = this.buildObjectKey(params.companyId, params.folder, params.filename);
    const bucket = this.getBucket();
    const expiresInSeconds = params.expiresInSeconds ?? 900;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: params.contentType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    return { key, url, expiresInSeconds };
  }

  async presignDownload(params: {
    companyId: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ key: string; url: string; expiresInSeconds: number }> {
    this.assertCompanyKeyOwnership(params.companyId, params.key);

    const bucket = this.getBucket();
    const expiresInSeconds = params.expiresInSeconds ?? 900;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    return { key: params.key, url, expiresInSeconds };
  }

  async getObjectBuffer(params: {
    companyId: string;
    key: string;
  }): Promise<{ key: string; buffer: Buffer; contentType: string | null }> {
    this.assertCompanyKeyOwnership(params.companyId, params.key);

    const bucket = this.getBucket();
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: params.key,
      }),
    );

    const chunks: Buffer[] = [];
    const body = response.Body as Readable | undefined;
    if (body) {
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    }

    return {
      key: params.key,
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType ?? null,
    };
  }

  async uploadBuffer(params: {
    companyId: string;
    folder: StorageFolder;
    filename: string;
    contentType?: string;
    buffer: Buffer;
  }): Promise<{ key: string }> {
    const key = this.buildObjectKey(params.companyId, params.folder, params.filename);
    const bucket = this.getBucket();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );

    return { key };
  }

  async uploadBufferToKey(params: {
    companyId: string;
    key: string;
    contentType?: string;
    buffer: Buffer;
  }): Promise<{ key: string }> {
    this.assertCompanyKeyOwnership(params.companyId, params.key);

    const bucket = this.getBucket();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );

    return { key: params.key };
  }
}
