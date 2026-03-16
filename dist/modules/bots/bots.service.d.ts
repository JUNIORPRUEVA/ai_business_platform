import { Repository } from 'typeorm';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { BotEntity } from './entities/bot.entity';
export declare class BotsService {
    private readonly botsRepository;
    constructor(botsRepository: Repository<BotEntity>);
    list(companyId: string): Promise<BotEntity[]>;
    get(companyId: string, id: string): Promise<BotEntity>;
    create(companyId: string, dto: CreateBotDto): Promise<BotEntity>;
    update(companyId: string, id: string, dto: UpdateBotDto): Promise<BotEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
    getDefaultActiveBot(companyId: string): Promise<BotEntity>;
}
