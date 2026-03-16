import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user) {
      throw new Error('Auth user not found on request. Did you forget JwtAuthGuard?');
    }
    return request.user;
  },
);
