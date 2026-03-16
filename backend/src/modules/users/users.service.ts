import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async list(companyId: string): Promise<Array<Omit<UserEntity, 'passwordHash'>>> {
    const users = await this.usersRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });

    return users.map(({ passwordHash: _ph, ...safe }) => safe);
  }

  async get(companyId: string, id: string): Promise<Omit<UserEntity, 'passwordHash'>> {
    const user = await this.usersRepository.findOne({
      where: { id, companyId },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async create(companyId: string, dto: CreateUserDto): Promise<Omit<UserEntity, 'passwordHash'>> {
    const entity = this.usersRepository.create({
      companyId,
      name: dto.name,
      email: dto.email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: dto.role ?? 'operator',
    });

    try {
      const saved = await this.usersRepository.save(entity);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _ph, ...safe } = saved;
      return safe;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
        throw new ConflictException('Email already exists for this company.');
      }
      throw error;
    }
  }

  async update(companyId: string, id: string, dto: UpdateUserDto): Promise<Omit<UserEntity, 'passwordHash'>> {
    const existing = await this.usersRepository.findOne({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    if (dto.email !== undefined) {
      existing.email = dto.email.toLowerCase().trim();
    }
    if (dto.name !== undefined) {
      existing.name = dto.name;
    }
    if (dto.role !== undefined) {
      existing.role = dto.role;
    }
    if (dto.password !== undefined) {
      existing.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    try {
      const saved = await this.usersRepository.save(existing);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _ph, ...safe } = saved;
      return safe;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
        throw new ConflictException('Email already exists for this company.');
      }
      throw error;
    }
  }

  async remove(companyId: string, id: string): Promise<{ deleted: true }> {
    const result = await this.usersRepository.delete({ id, companyId });
    if (result.affected === 0) {
      throw new NotFoundException('User not found.');
    }
    return { deleted: true };
  }
}
