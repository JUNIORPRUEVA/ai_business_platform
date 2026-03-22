import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';

import { BotCenterService } from '../services/bot-center.service';

@Controller('media')
export class PublicMediaController {
  constructor(private readonly botCenterService: BotCenterService) {}

  @Get('video/:messageId')
  async streamVideo(
    @Param('messageId') messageId: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: {
      setHeader(name: string, value: string): void;
      status(code: number): void;
    },
  ): Promise<StreamableFile> {
    const asset = await this.botCenterService.streamPublicVideo(messageId, range);

    response.status(asset.statusCode);
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);
    response.setHeader('Accept-Ranges', asset.acceptRanges);
    response.setHeader('Cache-Control', 'public, max-age=300');
    if (asset.contentLength != null) {
      response.setHeader('Content-Length', String(asset.contentLength));
    }
    if (asset.contentRange) {
      response.setHeader('Content-Range', asset.contentRange);
    }

    return new StreamableFile(asset.stream);
  }
}