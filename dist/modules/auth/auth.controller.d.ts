import { AuthUser } from '../../common/auth/auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    registerCompany(dto: RegisterCompanyDto): Promise<{
        company: import("../companies/entities/company.entity").CompanyEntity;
        adminUser: Omit<import("../users/entities/user.entity").UserEntity, "passwordHash">;
        accessToken: string;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
    }>;
    me(user: AuthUser): AuthUser;
}
