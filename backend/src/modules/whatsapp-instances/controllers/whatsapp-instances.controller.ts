import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';

import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { AuthUser } from '../../../common/auth/auth.types';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenseGuard } from '../../billing/license.guard';
import { CreateWhatsappInstanceDto } from '../dto/create-whatsapp-instance.dto';
import { LogoutWhatsappInstanceDto } from '../dto/logout-whatsapp-instance.dto';
import { UpdateWhatsappInstanceDto } from '../dto/update-whatsapp-instance.dto';
import { WhatsappInstancesService } from '../services/whatsapp-instances.service';

class InstanceParam {
  @IsString()
  @MinLength(1)
  instance!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('whatsapp')
export class WhatsappInstancesController {
  constructor(private readonly whatsappInstancesService: WhatsappInstancesService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get('instances')
  list(@CurrentUser() user: AuthUser) {
    return this.whatsappInstancesService.list(user.companyId);
  }

  @Roles('admin', 'operator')
  @Post('create-instance')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWhatsappInstanceDto) {
    return this.whatsappInstancesService.createInstance(user.companyId, dto.instanceName);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('qr/:instance')
  getQr(@CurrentUser() user: AuthUser, @Param() params: InstanceParam) {
    return this.whatsappInstancesService.getQRCode(user.companyId, params.instance);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('status/:instance')
  status(@CurrentUser() user: AuthUser, @Param() params: InstanceParam) {
    return this.whatsappInstancesService.refreshStatus(user.companyId, params.instance);
  }

  @Roles('admin', 'operator')
  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutWhatsappInstanceDto) {
    return this.whatsappInstancesService.logoutInstance(user.companyId, dto.instanceName);
  }

  @Roles('admin', 'operator')
  @Patch('instances/:instance')
  update(
    @CurrentUser() user: AuthUser,
    @Param() params: InstanceParam,
    @Body() dto: UpdateWhatsappInstanceDto,
  ) {
    return this.whatsappInstancesService.updateInstance(
      user.companyId,
      params.instance,
      dto.newInstanceName,
    );
  }

  @Roles('admin', 'operator')
  @Delete('instances/:instance')
  delete(@CurrentUser() user: AuthUser, @Param() params: InstanceParam) {
    return this.whatsappInstancesService.deleteInstance(user.companyId, params.instance);
  }

  @Roles('admin', 'operator')
  @Post('instances/:instance/webhook')
  configureWebhook(@CurrentUser() user: AuthUser, @Param() params: InstanceParam) {
    return this.whatsappInstancesService.configureWebhook(user.companyId, params.instance);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('instances/:instance/webhook')
  getWebhookStatus(@CurrentUser() user: AuthUser, @Param() params: InstanceParam) {
    return this.whatsappInstancesService.getWebhookStatus(user.companyId, params.instance);
  }
}
