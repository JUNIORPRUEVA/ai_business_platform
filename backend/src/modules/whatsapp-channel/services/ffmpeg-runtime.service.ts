import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

@Injectable()
export class FfmpegRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(FfmpegRuntimeService.name);
  private executable: string | null = null;
  private availabilityChecked = false;

  async onModuleInit(): Promise<void> {
    await this.validateAvailability();
  }

  async validateAvailability(): Promise<boolean> {
    if (this.availabilityChecked && this.executable) {
      return true;
    }

    const pathCandidate = await this.resolvePathCandidate();
    if (!pathCandidate) {
      this.logger.error('FFMPEG NOT INSTALLED - AUDIO PROCESSING DISABLED');
      this.availabilityChecked = true;
      this.executable = null;
      return false;
    }

    const probe = spawnSync(pathCandidate, ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
    });

    if (probe.status === 0) {
      this.executable = pathCandidate;
      this.availabilityChecked = true;
      const firstLine = probe.stdout?.split(/\r?\n/)[0]?.trim() ?? 'ffmpeg detected';
      this.logger.log(`[FFMPEG] available executable=${pathCandidate} version="${firstLine}"`);
      return true;
    }

    this.logger.error('FFMPEG NOT INSTALLED - AUDIO PROCESSING DISABLED');
    this.availabilityChecked = true;
    this.executable = null;
    return false;
  }

  async getExecutableOrThrow(): Promise<string> {
    const available = await this.validateAvailability();
    if (!available || !this.executable) {
      throw new Error('FFMPEG NOT INSTALLED - AUDIO PROCESSING DISABLED');
    }

    return this.executable;
  }

  private async resolvePathCandidate(): Promise<string | null> {
    const systemProbe = spawnSync('ffmpeg', ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (systemProbe.status === 0) {
      return 'ffmpeg';
    }

    const bundled = typeof ffmpegPath === 'string' ? ffmpegPath.trim() : '';
    if (!bundled) {
      return null;
    }

    try {
      await access(bundled, fsConstants.F_OK);
      return bundled;
    } catch {
      return null;
    }
  }
}
