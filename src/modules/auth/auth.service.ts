import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';

import { JwtPayload } from '../../common/auth/auth.types';
import { CompanyEntity } from '../companies/entities/company.entity';
import { UserEntity } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async registerCompany(dto: RegisterCompanyDto): Promise<{
    company: CompanyEntity;
    adminUser: Omit<UserEntity, 'passwordHash'>;
    accessToken: string;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const companiesRepo = manager.getRepository(CompanyEntity);
      const usersRepo = manager.getRepository(UserEntity);

      const company = companiesRepo.create({
        name: dto.companyName,
        plan: dto.plan ?? 'starter',
        status: 'active',
      });
      await companiesRepo.save(company);

      const email = dto.adminEmail.toLowerCase().trim();
      const already = await usersRepo.findOne({
        where: { companyId: company.id, email },
      });
      if (already) {
        throw new ConflictException('Admin email is already registered for this company.');
      }

      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      const adminUser = usersRepo.create({
        companyId: company.id,
        name: dto.adminName,
        email,
        passwordHash,
        role: 'admin',
      });
      await usersRepo.save(adminUser);

      const accessToken = this.signToken({
        sub: adminUser.id,
        companyId: company.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _ph, ...safeUser } = adminUser;
      return { company, adminUser: safeUser, accessToken };
    });
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersRepository.findOne({
      where: {
        companyId: dto.companyId,
        email: dto.email.toLowerCase().trim(),
      },
    });

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
