import { UserRole } from '../entities/user.entity';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsNotEmpty()
  name: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}

export class VerifyEmailDto {
  @IsNotEmpty()
  token: string;
}

export class ForgotPasswordRequestDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @MinLength(6)
  newPassword: string;
}

export class Verify2FADto {
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  code: string;
}

export class SocialLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  name: string;

  // googleId or appleId will be provided
  @IsOptional()
  googleId?: string;

  @IsOptional()
  appleId?: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  refreshToken: string;
}
