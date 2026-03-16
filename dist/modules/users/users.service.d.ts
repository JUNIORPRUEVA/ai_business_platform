import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository: Repository<UserEntity>);
    list(companyId: string): Promise<Array<Omit<UserEntity, 'passwordHash'>>>;
    get(companyId: string, id: string): Promise<Omit<UserEntity, 'passwordHash'>>;
    create(companyId: string, dto: CreateUserDto): Promise<Omit<UserEntity, 'passwordHash'>>;
    update(companyId: string, id: string, dto: UpdateUserDto): Promise<Omit<UserEntity, 'passwordHash'>>;
    remove(companyId: string, id: string): Promise<{
        deleted: true;
    }>;
}
