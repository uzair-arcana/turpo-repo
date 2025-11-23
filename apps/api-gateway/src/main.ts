import { ENV } from '@shared';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { RpcToHttpFilter } from './filters/rpc-to-http.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Register the RPC→HTTP filter globally
  app.useGlobalFilters(new RpcToHttpFilter());

  await app.listen(ENV.API_GATEWAY_PORT);
  Logger.log(`GATEWAY is running on port ${ENV.API_GATEWAY_PORT}`);
}
bootstrap();
