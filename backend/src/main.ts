import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const origins = (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  // Bind dual-stack ('::' = all IPv6 + IPv4). Railway healthchecks/private network
  // are IPv6-only, while its public edge uses IPv4 — '::' serves both. Fall back to
  // IPv4-only for hosts with IPv6 disabled (e.g. some on-prem servers).
  const port = Number(config.get<string>('PORT') ?? 3000);
  let boundHost = '::';
  try {
    await app.listen(port, '::');
  } catch {
    boundHost = '0.0.0.0';
    await app.listen(port, '0.0.0.0');
  }
  // eslint-disable-next-line no-console
  console.log(`Modern Colours API listening on ${boundHost}:${port} (prefix /api)`);
}
bootstrap();
