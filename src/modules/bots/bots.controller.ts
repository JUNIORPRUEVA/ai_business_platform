import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { BotsService } from './bots.service';

class IdParam {
  @IsUUID()
  id!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.botsService.list(user.companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.botsService.get(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBotDto) {
    return this.botsService.create(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param() params: IdParam, @Body() dto: UpdateBotDto) {
    return this.botsService.update(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.botsService.remove(user.companyId, params.id);
  }
}
