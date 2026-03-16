import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesService } from './companies.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.companiesService.getMyCompany(user.companyId);
  }

  @Roles('admin')
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMyCompany(user.companyId, dto);
  }
}
