import { IsEmail, IsNotEmpty, IsOptional, IsObject } from "class-validator";

export class EmailDto {
  @IsEmail()
  to: string;

  @IsNotEmpty()
  subject: string;

  @IsNotEmpty()
  template: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}
