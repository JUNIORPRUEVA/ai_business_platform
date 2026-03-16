import { Module } from '@nestjs/common';

import { BotConfigurationModule } from '../bot-configuration/bot-configuration.module';
import { OpenAiService } from './services/openai.service';

@Module({
  imports: [BotConfigurationModule],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenAiModule {}