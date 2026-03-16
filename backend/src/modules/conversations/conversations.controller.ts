import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseGuard } from '../billing/license.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationsService } from './conversations.service';

class IdParam {
  @IsUUID()
  id!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.conversationsService.list(user.companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.conversationsService.get(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param() params: IdParam, @Body() dto: UpdateConversationDto) {
    return this.conversationsService.update(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.conversationsService.remove(user.companyId, params.id);
  }
}
