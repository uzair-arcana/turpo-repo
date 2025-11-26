import { IsEmail, IsNotEmpty, IsOptional, IsObject, IsString } from "class-validator";

export class EmailDto {
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty({ message: "Recipient email is required" })
  to: string;

  @IsString()
  @IsNotEmpty({ message: "Email subject is required" })
  subject: string;

  @IsString()
  @IsNotEmpty({ message: "Email template is required" })
  template: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}
