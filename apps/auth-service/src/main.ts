import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ENV } from '@shared';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: ENV.AUTH_SERVICE_HOST,
        port: ENV.AUTH_SERVICE_PORT,
      },
    },
  );
  await app.listen();

  Logger.log(`Auth Service is running on TCP port ${ENV.AUTH_SERVICE_PORT}`);
}
bootstrap();
