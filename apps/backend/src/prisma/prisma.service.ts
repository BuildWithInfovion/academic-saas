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

    // Log queries that take more than 500 ms (cross-region RTT to Supabase is ~260ms baseline).
    this.$on('query' as never, (e: { query: string; duration: number }) => {
      if (e.duration >= 500) {
        this.logger.warn(
          `[SLOW QUERY] ${e.duration}ms — ${e.query.slice(0, 200)}`,
        );
      }
    });

    this.registerSoftDeleteMiddleware();
  }

  async onModuleDestroy() {
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

  /**
   * Retry a block up to `maxAttempts` times on Prisma connection-pool errors.
   * P2024 on Supabase pgBouncer means connection timeout or pool exhaustion.
   */
  async withConnectionRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 3000,
  ): Promise<T> {
    const CONNECTION_CODES = new Set([
      'P1001',
      'P1002',
      'P1008',
      'P1017',
      'P2024',
    ]);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (attempt < maxAttempts && code && CONNECTION_CODES.has(code)) {
          this.logger.warn(
            `Connection error (${code}) on attempt ${attempt}/${maxAttempts} — retrying in ${delayMs}ms`,
          );
          await new Promise((r) => setTimeout(r, delayMs));
        } else {
          throw err;
        }
      }
    }
    throw new Error('unreachable');
  }

  // ── Soft Delete Middleware ─────────────────────────────────────────────────

  private registerSoftDeleteMiddleware() {
    const softDeleteModels = [
      'Student',
      'User',
      'Institution',
      'AcademicUnit',
      'Inquiry',
      'Announcement',
      'Subject',
      'FeeHead',
      'FeeStructure',
      'Exam',
      'CalendarEvent',
      'StudentDocument',
    ];

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

      if (params.action === 'count') {
        params.args.where = { ...params.args.where, deletedAt: null };
      }

      if (params.action === 'aggregate') {
        params.args.where = { ...params.args.where, deletedAt: null };
      }

      if (params.action === 'groupBy') {
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
