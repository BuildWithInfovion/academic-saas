import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import compression from 'compression';

function normalizeOriginPattern(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function matchesAllowedOrigin(origin: string, pattern: string): boolean {
  const normalizedOrigin = normalizeOriginPattern(origin);
  const normalizedPattern = normalizeOriginPattern(pattern);

  if (!normalizedPattern) return false;
  if (normalizedPattern === '*') return true;
  if (!normalizedPattern.includes('*')) return normalizedOrigin === normalizedPattern;

  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  return new RegExp(`^${escaped}$`).test(normalizedOrigin);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  // CORS — exact origins and wildcard patterns are both supported.
  // Always include localhost (dev) and Vercel preview deployments.
  // CORS_ORIGIN can be set to add production domains without removing these defaults.
  const ALWAYS_ALLOWED = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://*.vercel.app',
  ];
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => normalizeOriginPattern(o)).filter(Boolean)
    : [];
  const allowedOrigins = [...new Set([...ALWAYS_ALLOWED, ...envOrigins])];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = allowedOrigins.some((pattern) =>
        matchesAllowedOrigin(origin, pattern),
      );

      if (allowed) return callback(null, true);

      logger.warn(`Blocked CORS origin: ${origin}`);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });

  app.use(compression());

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Prisma error handler
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}`);
}

void bootstrap();
