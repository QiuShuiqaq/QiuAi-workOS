import 'reflect-metadata';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './modules/app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true
  });

  configureApplication(app);

  return app;
}

export function configureApplication(app: NestFastifyApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1'
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}

export async function bootstrap() {
  const app = await createApplication();

  const host = process.env.SERVER_HOST ?? '127.0.0.1';
  const port = Number(process.env.SERVER_PORT ?? 4000);

  await app.listen({ host, port });
  Logger.log(`QiuAI WorkOS server is running at http://${host}:${port}/api/v1`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap();
}
