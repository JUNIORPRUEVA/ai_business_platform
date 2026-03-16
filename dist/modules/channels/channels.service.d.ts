import { Repository } from 'typeorm';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelEntity } from './entities/channel.entity';
export declare class ChannelsService {
    private readonly channelsRepository;
    constructor(channelsRepository: Repository<ChannelEntity>);
    list(companyId: string): Promise<ChannelEntity[]>;
    get(companyId: string, id: string): Promise<ChannelEntity>;
    create(companyId: string, dto: CreateChannelDto): Promise<ChannelEntity>;
    update(companyId: string, id: string, dto: UpdateChannelDto): Promise<ChannelEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
    getByIdUnsafe(id: string): Promise<ChannelEntity>;
}
