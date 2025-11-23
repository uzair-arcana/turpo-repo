import {
  Body,
  Controller,
  Inject,
  Post,
  Version,
  Get,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  SERVICES,
  SignupDto,
  LoginDto,
  VerifyEmailDto,
  ForgotPasswordRequestDto,
  ResetPasswordDto,
  Verify2FADto,
  SocialLoginDto,
  RefreshTokenDto,
} from '@shared';
import { firstValueFrom } from 'rxjs';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(SERVICES.AUTH) private readonly authClient: ClientProxy
  ) {}

  @Post('signup')
  @Version('1')
  async signup(@Body() signupDto: SignupDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.SIGNUP }, signupDto)
    );
  }

  @Post('login')
  @Version('1')
  async login(@Body() loginDto: LoginDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.LOGIN }, loginDto)
    );
  }

  @Get('verify-email')
  @Version('1')
  async verifyEmail(@Query() verifyEmailDto: VerifyEmailDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.VERIFY_EMAIL }, verifyEmailDto)
    );
  }

  @Post('forgot-password')
  @Version('1')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordRequestDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send(
        { cmd: AUTH_PATTERNS.FORGOT_PASSWORD_REQUEST },
        forgotPasswordDto
      )
    );
  }

  @Post('reset-password')
  @Version('1')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send(
        { cmd: AUTH_PATTERNS.RESET_PASSWORD },
        resetPasswordDto
      )
    );
  }

  @Post('verify-2fa')
  @Version('1')
  async verify2FA(@Body() verify2FADto: Verify2FADto) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.VERIFY_2FA }, verify2FADto)
    );
  }

  @Post('google')
  @Version('1')
  async googleLogin(@Body() socialLoginDto: SocialLoginDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.GOOGLE_LOGIN }, socialLoginDto)
    );
  }

  @Post('apple')
  @Version('1')
  async appleLogin(@Body() socialLoginDto: SocialLoginDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.APPLE_LOGIN }, socialLoginDto)
    );
  }

  @Post('refresh-token')
  @Version('1')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await firstValueFrom<unknown>(
      this.authClient.send(
        { cmd: AUTH_PATTERNS.REFRESH_TOKEN },
        refreshTokenDto
      )
    );
  }
}
