import 'reflect-metadata';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './modules/app.module';
import { getDesktopReleaseUploadMaxBytes } from './shared/desktop-release-assets';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 24 * 1024 * 1024 }),
    {
      bufferLogs: true
    }
  );

  configureApplication(app);

  return app;
}

export function configureApplication(app: NestFastifyApplication): void {
  configureBinaryBodyParser(app);
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

function configureBinaryBodyParser(app: NestFastifyApplication): void {
  const fastify = app.getHttpAdapter().getInstance();
  const contentType = 'application/octet-stream';

  if (fastify.hasContentTypeParser(contentType)) {
    return;
  }

  fastify.addContentTypeParser(
    contentType,
    {
      parseAs: 'buffer',
      bodyLimit: getDesktopReleaseUploadMaxBytes()
    },
    (_request, body, done) => {
      done(null, body);
    }
  );
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
