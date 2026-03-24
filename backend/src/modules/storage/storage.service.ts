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
  private static readonly defaultContentDisposition = 'inline';

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
    contentDisposition?: string;
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

  async getObjectStream(params: {
    companyId: string;
    key: string;
    range?: string | null;
  }): Promise<{
    key: string;
    stream: Readable;
    contentType: string | null;
    contentLength: number | null;
    contentRange: string | null;
    acceptRanges: string | null;
    statusCode: number;
  }> {
    this.assertCompanyKeyOwnership(params.companyId, params.key);

    const bucket = this.getBucket();
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: params.key,
        ...(this.normalizeRangeHeader(params.range) ? { Range: this.normalizeRangeHeader(params.range)! } : {}),
      }),
    );

    const stream = response.Body as Readable | undefined;
    if (!stream) {
      throw new BadRequestException('Stored object stream is empty.');
    }

    return {
      key: params.key,
      stream,
      contentType: response.ContentType ?? null,
      contentLength: typeof response.ContentLength === 'number' ? response.ContentLength : null,
      contentRange: response.ContentRange ?? null,
      acceptRanges: response.AcceptRanges ?? 'bytes',
      statusCode: response.ContentRange ? 206 : 200,
    };
  }

  async uploadBuffer(params: {
    companyId: string;
    folder: StorageFolder;
    filename: string;
    contentType?: string;
    contentDisposition?: string;
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
        ContentDisposition: this.resolveContentDisposition(params.contentDisposition),
      }),
    );

    return { key };
  }

  async uploadBufferToKey(params: {
    companyId: string;
    key: string;
    contentType?: string;
    contentDisposition?: string;
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
        ContentDisposition: this.resolveContentDisposition(params.contentDisposition),
      }),
    );

    return { key: params.key };
  }

  async verifyObjectDownload(params: {
    companyId: string;
    key: string;
    expectedContentType?: string | null;
    expectedContentDisposition?: string | null;
    rangeBytes?: number;
  }): Promise<{ url: string; contentType: string | null; contentDisposition: string | null }> {
    const signed = await this.presignDownload({
      companyId: params.companyId,
      key: params.key,
      expiresInSeconds: 300,
    });

    this.assertHttpUrl(signed.url);

    const rangeBytes = Math.max(512, params.rangeBytes ?? 4096);
    const response = await fetch(signed.url, {
      method: 'GET',
      headers: {
        Range: `bytes=0-${rangeBytes - 1}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException(`Stored object is not accessible (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new BadRequestException('Stored object is empty.');
    }

    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    const expectedContentType = this.normalizeContentType(params.expectedContentType ?? null);
    const resolvedContentType = this.normalizeContentType(contentType);
    if (
      expectedContentType &&
      resolvedContentType &&
      expectedContentType !== resolvedContentType
    ) {
      throw new BadRequestException(
        `Stored object content type mismatch. expected=${expectedContentType} actual=${resolvedContentType}`,
      );
    }

    const expectedDisposition = (params.expectedContentDisposition?.trim() || StorageService.defaultContentDisposition).toLowerCase();
    if (
      contentDisposition &&
      !contentDisposition.toLowerCase().includes(expectedDisposition)
    ) {
      throw new BadRequestException(
        `Stored object content disposition mismatch. expected=${expectedDisposition} actual=${contentDisposition}`,
      );
    }

    return {
      url: signed.url,
      contentType,
      contentDisposition,
    };
  }

  private resolveContentDisposition(value?: string | null): string {
    const trimmed = value?.trim() ?? '';
    return trimmed || StorageService.defaultContentDisposition;
  }

  private normalizeContentType(value: string | null): string | null {
    const trimmed = value?.trim().toLowerCase() ?? '';
    if (!trimmed) {
      return null;
    }

    return trimmed.split(';')[0]?.trim() ?? null;
  }

  private assertHttpUrl(value: string): void {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException('Generated storage URL is invalid.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Generated storage URL must use HTTP/HTTPS.');
    }
  }

  private normalizeRangeHeader(value?: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    return /^bytes=\d*-\d*$/i.test(trimmed) ? trimmed : null;
  }
}
