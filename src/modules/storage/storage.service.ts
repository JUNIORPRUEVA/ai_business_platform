import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

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
    if (!params.key.startsWith(`${params.companyId}/`)) {
      throw new BadRequestException('Key does not belong to this company.');
    }

    const bucket = this.getBucket();
    const expiresInSeconds = params.expiresInSeconds ?? 900;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    return { key: params.key, url, expiresInSeconds };
  }
}
