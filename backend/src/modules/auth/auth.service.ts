import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { JwtPayload } from '../../common/auth/auth.types';
import { CompanyEntity } from '../companies/entities/company.entity';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { UserEntity } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly provisioningService: ProvisioningService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async registerCompany(dto: RegisterCompanyDto): Promise<{
    company: CompanyEntity;
    adminUser: Omit<UserEntity, 'passwordHash'>;
    accessToken: string;
  }> {
    const provisioned = await this.provisioningService.provisionCompany(dto);

    const accessToken = this.signToken({
      sub: provisioned.adminUser.id,
      companyId: provisioned.company.id,
      role: provisioned.adminUser.role,
      email: provisioned.adminUser.email,
      name: provisioned.adminUser.name,
    });

    return {
      company: provisioned.company,
      adminUser: provisioned.adminUser,
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const email = dto.email.toLowerCase().trim();
    let user: UserEntity | null = null;

    if (dto.companyId) {
      user = await this.usersRepository.findOne({
        where: {
          companyId: dto.companyId,
          email,
        },
      });
    } else {
      const matches = await this.usersRepository.find({
        where: { email },
        take: 2,
      });

      if (matches.length === 1) {
        user = matches[0];
      }
      if (matches.length > 1) {
        throw new ConflictException(
          'Multiple companies found for this email. Provide companyId to login.',
        );
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const accessToken = this.signToken({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    return { accessToken };
  }

  private signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}
