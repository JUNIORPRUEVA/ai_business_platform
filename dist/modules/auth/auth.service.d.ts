import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { CompanyEntity } from '../companies/entities/company.entity';
import { UserEntity } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
export declare class AuthService {
    private readonly dataSource;
    private readonly jwtService;
    private readonly usersRepository;
    constructor(dataSource: DataSource, jwtService: JwtService, usersRepository: Repository<UserEntity>);
    registerCompany(dto: RegisterCompanyDto): Promise<{
        company: CompanyEntity;
        adminUser: Omit<UserEntity, 'passwordHash'>;
        accessToken: string;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
    }>;
    private signToken;
}
