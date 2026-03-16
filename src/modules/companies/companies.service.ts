import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CompanyEntity } from './entities/company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companiesRepository: Repository<CompanyEntity>,
  ) {}

  async getMyCompany(companyId: string): Promise<CompanyEntity> {
    const company = await this.companiesRepository.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    return company;
  }

  async updateMyCompany(companyId: string, dto: UpdateCompanyDto): Promise<CompanyEntity> {
    const company = await this.getMyCompany(companyId);
    const updated = this.companiesRepository.merge(company, dto);
    return this.companiesRepository.save(updated);
  }
}
