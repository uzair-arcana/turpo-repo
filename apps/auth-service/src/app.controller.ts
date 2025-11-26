import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AppService } from './app.service';
import {
  AUTH_PATTERNS,
  ForgotPasswordRequestDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SignupDto,
  SocialLoginDto,
  Verify2FADto,
  VerifyEmailDto,
} from '@shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: AUTH_PATTERNS.SIGNUP })
  signup(@Payload() dto: SignupDto) {
    return this.appService.signup(dto);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.LOGIN })
  login(@Payload() dto: LoginDto) {
    return this.appService.login(dto);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.VERIFY_EMAIL })
  verifyEmail(@Payload() dto: VerifyEmailDto) {
    return this.appService.verifyEmail(dto.token);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.FORGOT_PASSWORD_REQUEST })
  forgotPassword(@Payload() dto: ForgotPasswordRequestDto) {
    return this.appService.requestPasswordReset(dto.email);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.RESET_PASSWORD })
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.appService.resetPassword(dto.token, dto.newPassword);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.VERIFY_2FA })
  verify2FA(@Payload() dto: Verify2FADto) {
    return this.appService.verify2FA(dto.userId, dto.code);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.GOOGLE_LOGIN })
  googleLogin(@Payload() dto: SocialLoginDto) {
    return this.appService.socialLogin({ ...dto, provider: 'google' });
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.APPLE_LOGIN })
  appleLogin(@Payload() dto: SocialLoginDto) {
    return this.appService.socialLogin({ ...dto, provider: 'apple' });
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.REFRESH_TOKEN })
  refreshToken(@Payload() dto: RefreshTokenDto) {
    return this.appService.refreshToken(dto.refreshToken);
  }

  @MessagePattern({ cmd: AUTH_PATTERNS.LOGOUT })
  logout(@Payload() payload: { accessToken: string }) {
    return this.appService.logout(payload.accessToken);
  }
}
