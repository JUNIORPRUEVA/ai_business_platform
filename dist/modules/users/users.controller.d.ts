import { AuthUser } from '../../common/auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
declare class IdParam {
    id: string;
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    list(user: AuthUser): Promise<Omit<import("./entities/user.entity").UserEntity, "passwordHash">[]>;
    get(user: AuthUser, params: IdParam): Promise<Omit<import("./entities/user.entity").UserEntity, "passwordHash">>;
    create(user: AuthUser, dto: CreateUserDto): Promise<Omit<import("./entities/user.entity").UserEntity, "passwordHash">>;
    update(user: AuthUser, params: IdParam, dto: UpdateUserDto): Promise<Omit<import("./entities/user.entity").UserEntity, "passwordHash">>;
    remove(user: AuthUser, params: IdParam): Promise<{
        deleted: true;
    }>;
}
export {};
