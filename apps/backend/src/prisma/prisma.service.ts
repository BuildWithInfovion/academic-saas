import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'query' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();

    // Log queries that take more than 200 ms — surfaces missing indexes quickly.
    this.$on('query' as never, (e: { query: string; duration: number }) => {
      if (e.duration >= 200) {
        this.logger.warn(
          `[SLOW QUERY] ${e.duration}ms — ${e.query.slice(0, 200)}`,
        );
      }
    });

    this.registerSoftDeleteMiddleware();
    this.startKeepAlive();
  }

  async onModuleDestroy() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    await this.$disconnect();
  }

  // ── Retry-capable connect ──────────────────────────────────────────────────

  private async connectWithRetry(maxAttempts = 6, baseDelayMs = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected');
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(1.5, attempt - 1);
          this.logger.warn(
            `DB connect attempt ${attempt}/${maxAttempts} failed: ${msg}. Retrying in ${Math.round(delay)}ms…`,
          );
          await new Promise((r) => setTimeout(r, delay));
        } else {
          this.logger.error(
            `DB connect failed after ${maxAttempts} attempts: ${msg}`,
          );
          throw err;
        }
      }
    }
  }

  // ── Keep-alive ping every 4 minutes (Neon idles at 5 min) ─────────────────

  private startKeepAlive() {
    this.keepAliveTimer = setInterval(
      () =>
        void this.$queryRaw`SELECT 1`.catch(() => {
          this.logger.warn('Keep-alive ping failed — attempting reconnect');
          void this.$disconnect()
            .then(() => this.connectWithRetry(3, 1000))
            .catch(() => {
              this.logger.error(
                'Reconnect after keep-alive failure also failed',
              );
            });
        }),
      4 * 60 * 1000,
    );
    this.keepAliveTimer.unref?.();
  }

  // ── Soft Delete Middleware ─────────────────────────────────────────────────

  private registerSoftDeleteMiddleware() {
    const softDeleteModels = ['Student', 'User', 'Institution'];

    /* eslint-disable
       @typescript-eslint/no-unsafe-assignment,
       @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-return */
    this.$use(async (params, next) => {
      if (!params.model || !softDeleteModels.includes(params.model)) {
        return next(params);
      }

      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = { deletedAt: new Date() };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (!params.args.data) params.args.data = {};
        params.args.data['deletedAt'] = new Date();
      }

      if (params.action === 'findMany') {
        params.args.where = { ...params.args.where, deletedAt: null };
      }

      if (params.action === 'findFirst') {
        params.args.where = { ...params.args.where, deletedAt: null };
      }

      if (params.action === 'findUnique') {
        params.action = 'findFirst';
        params.args.where = { ...params.args.where, deletedAt: null };
      }

      return next(params);
    });
    /* eslint-enable
       @typescript-eslint/no-unsafe-assignment,
       @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-return */
  }
}
