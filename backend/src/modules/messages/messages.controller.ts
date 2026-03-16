import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseGuard } from '../billing/license.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

class ConversationParam {
  @IsUUID()
  conversationId!: string;
}

class ListQuery {
  @IsOptional()
  limit?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param() params: ConversationParam,
    @Query() query: ListQuery,
  ) {
    const limit = query.limit ? Number(query.limit) : 50;
    return this.messagesService.list(user.companyId, params.conversationId, limit);
  }

  @Roles('admin', 'operator')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param() params: ConversationParam,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.createFromUser(user.companyId, params.conversationId, dto);
  }
}
