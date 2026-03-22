import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppErrorLogService } from './common/errors/app-error-log.service';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const globalExceptionFilter = app.get(GlobalExceptionFilter);
  const appErrorLogService = app.get(AppErrorLogService);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(globalExceptionFilter);

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    appErrorLogService.add({
      id: `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'internal',
      message: error.message || 'Unhandled rejection',
      details: [],
      module: 'process',
      timestamp: new Date().toISOString(),
      statusCode: 500,
      path: 'process:unhandledRejection',
      method: 'SYSTEM',
      requestId: 'system',
      source: 'backend',
      stack: error.stack,
    });
  });

  process.on('uncaughtException', (error) => {
    appErrorLogService.add({
      id: `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'internal',
      message: error.message || 'Uncaught exception',
      details: [],
      module: 'process',
      timestamp: new Date().toISOString(),
      statusCode: 500,
      path: 'process:uncaughtException',
      method: 'SYSTEM',
      requestId: 'system',
      source: 'backend',
      stack: error.stack,
    });
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();