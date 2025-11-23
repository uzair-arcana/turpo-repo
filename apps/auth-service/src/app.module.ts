import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { DatabaseModule, RedisModule, ENV, SERVICES } from '@shared';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    JwtModule.register({
      secret: ENV.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    ClientsModule.register([
      {
        name: SERVICES.EMAIL,
        transport: Transport.TCP,
        options: {
          host: ENV.EMAIL_SERVICE_HOST,
          port: ENV.EMAIL_SERVICE_PORT,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
