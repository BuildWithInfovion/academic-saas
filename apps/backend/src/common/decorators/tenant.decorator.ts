import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // ✅ req.tenant set by TenantGuard (protected routes)
    // ✅ req.user.institutionId set by JwtStrategy (auth routes)
    // ✅ header fallback for login route
    const institutionId =
      request.tenant?.institutionId ||
      request.user?.institutionId ||
      request.headers['x-institution-id'];

    return { institutionId };
  },
);