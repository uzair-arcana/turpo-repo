import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ENV } from '@shared';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      host: ENV.EMAIL_SERVICE_HOST,
      port: ENV.EMAIL_SERVICE_PORT,
    },
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false, // Allow additional properties to pass through
  }));

  Logger.log(`Email Service is running on TCP port ${ENV.EMAIL_SERVICE_PORT}`);

  await app.listen();
  // keep a small HTTP endpoint for health if needed in the future
}

bootstrap();
