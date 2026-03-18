import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class EvolutionWebhookKeyDto {
  @IsString()
  remoteJid!: string;

  @IsOptional()
  @IsString()
  id?: string;
}

class EvolutionWebhookDataDto {
  @ValidateNested()
  @Type(() => EvolutionWebhookKeyDto)
  key!: EvolutionWebhookKeyDto;

  @IsOptional()
  @IsString()
  pushName?: string;

  @IsOptional()
  @IsObject()
  message?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  messageTimestamp?: string;
}

export class EvolutionMessageWebhookDto {
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsString()
  instance?: string;

  @ValidateNested()
  @Type(() => EvolutionWebhookDataDto)
  data!: EvolutionWebhookDataDto;
}