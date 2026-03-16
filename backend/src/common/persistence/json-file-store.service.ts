import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

@Injectable()
export class JsonFileStoreService {
  constructor(private readonly configService: ConfigService) {}

  async readOrCreate<T>(
    relativeFilePath: string,
    fallbackFactory: () => T,
  ): Promise<T> {
    const absolutePath = this.resolveStoragePath(relativeFilePath);

    try {
      const raw = await readFile(absolutePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      const fallback = fallbackFactory();
      await this.write(relativeFilePath, fallback);
      return fallback;
    }
  }

  async write<T>(relativeFilePath: string, value: T): Promise<void> {
    const absolutePath = this.resolveStoragePath(relativeFilePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  resolveStoragePath(relativeFilePath: string): string {
    const storageDir =
      this.configService.get<string>('BACKEND_STORAGE_DIR') ?? 'data';
    return resolve(join(process.cwd(), storageDir, relativeFilePath));
  }
}