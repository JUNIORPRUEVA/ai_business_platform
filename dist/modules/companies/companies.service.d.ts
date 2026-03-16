import { Repository } from 'typeorm';
import { CompanyEntity } from './entities/company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
export declare class CompaniesService {
    private readonly companiesRepository;
    constructor(companiesRepository: Repository<CompanyEntity>);
    getMyCompany(companyId: string): Promise<CompanyEntity>;
    updateMyCompany(companyId: string, dto: UpdateCompanyDto): Promise<CompanyEntity>;
}
