import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { ENV } from "../util/env";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
      username: ENV.DB_USER,
      password: ENV.DB_PASS,
      database: ENV.DB_NAME,
      entities: [User],
      synchronize: false,
      migrationsRun: true,
      migrations: [__dirname + "/migrations/*{.ts,.js}"],
    }),
    TypeOrmModule.forFeature([User]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
