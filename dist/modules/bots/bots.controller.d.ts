import { AuthUser } from '../../common/auth/auth.types';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { BotsService } from './bots.service';
declare class IdParam {
    id: string;
}
export declare class BotsController {
    private readonly botsService;
    constructor(botsService: BotsService);
    list(user: AuthUser): Promise<import("./entities/bot.entity").BotEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/bot.entity").BotEntity>;
    create(user: AuthUser, dto: CreateBotDto): Promise<import("./entities/bot.entity").BotEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateBotDto): Promise<import("./entities/bot.entity").BotEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
