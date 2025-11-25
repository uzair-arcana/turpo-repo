import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      url: "postgresql://neondb_owner:npg_K7QClNwxBzA1@ep-summer-math-adk2ktek-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      entities: [User],
      synchronize: true, // Change to true temporarily
      migrationsRun: false, // Disable migrations for now
      ssl: true,
      extra: {
        ssl: {
          rejectUnauthorized: false
        }
      }
    }),
    TypeOrmModule.forFeature([User]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}