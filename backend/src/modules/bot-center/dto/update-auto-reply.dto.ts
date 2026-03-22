import { IsBoolean } from 'class-validator';

export class UpdateAutoReplyDto {
  @IsBoolean()
  enabled!: boolean;
}