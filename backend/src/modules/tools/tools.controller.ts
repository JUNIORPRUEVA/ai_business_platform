import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseGuard } from '../billing/license.guard';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolsService } from './tools.service';

class IdParam {
  @IsUUID()
  id!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.toolsService.list(user.companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.toolsService.get(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateToolDto) {
    return this.toolsService.create(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param() params: IdParam, @Body() dto: UpdateToolDto) {
    return this.toolsService.update(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.toolsService.remove(user.companyId, params.id);
  }
}
