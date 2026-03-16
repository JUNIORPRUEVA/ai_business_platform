import { AuthUser } from '../../common/auth/auth.types';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesService } from './companies.service';
export declare class CompaniesController {
    private readonly companiesService;
    constructor(companiesService: CompaniesService);
    me(user: AuthUser): Promise<import("./entities/company.entity").CompanyEntity>;
    updateMe(user: AuthUser, dto: UpdateCompanyDto): Promise<import("./entities/company.entity").CompanyEntity>;
}
