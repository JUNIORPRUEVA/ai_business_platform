import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseGuard } from '../billing/license.guard';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelsService } from './channels.service';

class IdParam {
  @IsUUID()
  id!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.channelsService.list(user.companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.channelsService.get(user.companyId, params.id);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id/qrcode')
  getQrCode(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.channelsService.getQrCode(user.companyId, params.id);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id/status')
  getStatus(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.channelsService.refreshConnectionStatus(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post(':id/disconnect')
  disconnect(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.channelsService.disconnect(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param() params: IdParam, @Body() dto: UpdateChannelDto) {
    return this.channelsService.update(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.channelsService.remove(user.companyId, params.id);
  }
}
