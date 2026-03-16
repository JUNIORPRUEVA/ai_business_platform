import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '../../common/auth/auth.types';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: JwtPayload): AuthUser;
}
export {};
