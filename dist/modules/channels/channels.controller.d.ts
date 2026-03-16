import { AuthUser } from '../../common/auth/auth.types';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelsService } from './channels.service';
declare class IdParam {
    id: string;
}
export declare class ChannelsController {
    private readonly channelsService;
    constructor(channelsService: ChannelsService);
    list(user: AuthUser): Promise<import("./entities/channel.entity").ChannelEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/channel.entity").ChannelEntity>;
    create(user: AuthUser, dto: CreateChannelDto): Promise<import("./entities/channel.entity").ChannelEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateChannelDto): Promise<import("./entities/channel.entity").ChannelEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
