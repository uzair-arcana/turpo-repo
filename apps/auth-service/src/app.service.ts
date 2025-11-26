import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as otpGenerator from 'otp-generator';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  EmailPayload,
  ENV,
  JwtPayload,
  LoginDto,
  LoginSession,
  RefreshJwtPayload,
  SERVICES,
  SessionData,
  SignupDto,
  TokenLookup,
  Tokens,
  User,
  UserRole,
} from '@shared';

// -----------------------------------------------------
//                     SERVICE
// -----------------------------------------------------

@Injectable()
export class AppService {
  private readonly refreshSecret: string;
  private readonly refreshTtlSeconds: number;
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(SERVICES.EMAIL) private readonly emailClient: ClientProxy,
  ) {
    this.refreshSecret = ENV.JWT_REFRESH_SECRET;
    this.refreshTtlSeconds = ENV.JWT_REFRESH_TTL_SECONDS;
  }

  // ---------------- Signup ----------------

  async signup(dto: SignupDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new RpcException({ status: 400, message: 'Email already in use' });
    }

    const hashed: string = await bcrypt.hash(dto.password, 10);
    const emailVerificationToken = uuidv4();

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      password: hashed,
      name: dto.name,
      role: dto.role || UserRole.CLIENT,
      isEmailVerified: false,
      emailVerificationToken,
      connects: dto.role === UserRole.FREELANCER ? 60 : null,
      isTwoFactorEnabled: true,
    });

    await this.userRepo.save(user);

    this.sendEmail({
      to: user.email,
      subject: 'Verify your email',
      template: 'verify-email',
      context: {
        name: user.name,
        token: emailVerificationToken,
      },
    });

    return { message: 'Signup successful, please verify your email.' };
  }

  // ---------------- Login (send OTP) ----------------

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.password) {
      throw new RpcException({ status: 401, message: 'Invalid credentials' });
    }

    const passwordMatch: boolean = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!passwordMatch) {
      throw new RpcException({ status: 401, message: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      throw new RpcException({ status: 401, message: 'Email not verified' });
    }

    const code = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    const key = `2fa:${user.id}`;
    await this.cacheManager.set(key, code, 300_000);

    const loginSessionKey = `login:${user.id}`;
    const loginSession: LoginSession = {
      userId: user.id,
      email: user.email,
      verified: false,
    };

    await this.cacheManager.set(loginSessionKey, loginSession, 300_000);

    this.sendEmail({
      to: user.email,
      subject: 'Your 2FA Code',
      template: '2fa-code',
      context: { name: user.name, code },
    });

    return { requires2FA: true, userId: user.id };
  }

  // ---------------- Verify OTP ----------------

  async verify2FA(userId: string, code: string) {
    const key = `2fa:${userId}`;
    const storedCode = await this.cacheManager.get<string>(key);

    if (!storedCode || storedCode !== code) {
      throw new RpcException({
        status: 401,
        message: 'Invalid or expired 2FA code',
      });
    }

    const loginSessionKey = `login:${userId}`;
    const loginSession =
      await this.cacheManager.get<LoginSession>(loginSessionKey);

    if (!loginSession) {
      throw new RpcException({
        status: 401,
        message: 'Login session expired. Please login again.',
      });
    }

    await this.cacheManager.del(key);
    await this.cacheManager.del(loginSessionKey);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user)
      throw new RpcException({ status: 401, message: 'User not found' });

    const tokens = await this.generateTokens(user);

    const sessionKey = `session:${user.id}`;
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      accessToken: tokens.accessToken,
      createdAt: new Date().toISOString(),
    };

    await this.cacheManager.set(sessionKey, sessionData, 900_000);

    const tokenKey = `token:${tokens.accessToken}`;
    const lookupData: TokenLookup = {
      userId: user.id,
      role: user.role,
    };

    await this.cacheManager.set(tokenKey, lookupData, 900_000);

    return tokens;
  }

  // ---------------- Verify Email ----------------

  async verifyEmail(token: string) {
    const user = await this.userRepo.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new RpcException({ status: 400, message: 'Invalid token' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    await this.userRepo.save(user);

    return { message: 'Email verified successfully' };
  }

  // ---------------- Request Password Reset ----------------

  async requestPasswordReset(email: string) {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user)
      return { message: 'If that email exists, a reset link was sent' };

    const token = uuidv4();
    user.forgotPasswordToken = token;
    await this.userRepo.save(user);

    this.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      template: 'reset-password',
      context: { name: user.name, token },
    });

    return { message: 'If that email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepo.findOne({
      where: { forgotPasswordToken: token },
    });

    if (!user) {
      throw new RpcException({ status: 400, message: 'Invalid token' });
    }

    const hashed: string = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.forgotPasswordToken = null;

    await this.userRepo.save(user);

    return { message: 'Password updated successfully' };
  }

  // ---------------- Social Login ----------------

  async socialLogin(params: {
    email: string;
    name: string;
    googleId?: string;
    appleId?: string;
    provider: 'google' | 'apple';
  }) {
    const { email, name, googleId, appleId, provider } = params;

    let user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      user = this.userRepo.create({
        email: email.toLowerCase(),
        name,
        isEmailVerified: true,
        role: UserRole.CLIENT,
        isTwoFactorEnabled: true,
        googleId: provider === 'google' ? googleId : null,
        appleId: provider === 'apple' ? appleId : null,
      });
    } else {
      if (provider === 'google' && !user.googleId)
        user.googleId = googleId || null;
      if (provider === 'apple' && !user.appleId) user.appleId = appleId || null;
      if (!user.isEmailVerified) user.isEmailVerified = true;
      if (!user.isTwoFactorEnabled) user.isTwoFactorEnabled = true;
    }

    await this.userRepo.save(user);

    const code = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    const key = `2fa:${user.id}`;
    await this.cacheManager.set(key, code, 300_000);

    const loginSessionKey = `login:${user.id}`;
    const session: LoginSession = {
      userId: user.id,
      email: user.email,
      verified: false,
    };

    await this.cacheManager.set(loginSessionKey, session, 300_000);

    this.sendEmail({
      to: user.email,
      subject: 'Your 2FA Code',
      template: '2fa-code',
      context: { name: user.name, code },
    });

    return { requires2FA: true, userId: user.id };
  }

  // ---------------- Token Generation ----------------

  private async generateTokens(user: User): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const jti = uuidv4();

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti } satisfies RefreshJwtPayload,
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      },
    );

    const key = `refresh:${user.id}:${jti}`;
    await this.cacheManager.set(key, '1', this.refreshTtlSeconds * 1000);

    return { accessToken, refreshToken };
  }

  // ---------------- Logout ----------------

  async invalidateSession(accessToken: string): Promise<void> {
    try {
      const decoded =
        await this.jwtService.verifyAsync<JwtPayload>(accessToken);

      const userId = decoded.sub;
      await this.cacheManager.del(`token:${accessToken}`);
      await this.cacheManager.del(`session:${userId}`);
    } catch {
      // ignore errors
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = await this.jwtService.verifyAsync<RefreshJwtPayload>(
        refreshToken,
        { secret: this.refreshSecret },
      );

      const { sub: userId, jti } = decoded;

      const key = `refresh:${userId}:${jti}`;
      const exists = await this.cacheManager.get<string>(key);

      if (!exists) {
        throw new RpcException({
          status: 401,
          message: 'Invalid refresh token',
        });
      }

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new RpcException({ status: 401, message: 'User not found' });
      }

      const payload: JwtPayload = {
        sub: user.id,
        role: user.role,
        email: user.email,
      };

      const accessToken = await this.jwtService.signAsync(payload);

      const sessionKey = `session:${userId}`;
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        role: user.role,
        accessToken,
        createdAt: new Date().toISOString(),
      };

      await this.cacheManager.set(sessionKey, sessionData, 900_000);
      await this.cacheManager.set(`token:${accessToken}`, sessionData, 900_000);

      return { accessToken };
    } catch (err) {
      if (err instanceof RpcException) throw err;

      throw new RpcException({
        status: 401,
        message: 'Invalid refresh token',
      });
    }
  }

  async logout(accessToken: string): Promise<{ message: string }> {
    await this.invalidateSession(accessToken);
    return { message: 'Logged out successfully' };
  }

  // ---------------- Email Sender ----------------

  private sendEmail(payload: EmailPayload): void {
    try {
      this.emailClient.emit({ cmd: 'send_email' }, payload).subscribe({
        next: () => {
          this.logger.debug('Email message emitted');
        },
        error: (error: unknown) => {
          this.logger.error(
            'Failed to emit email message',
            error instanceof Error ? error.stack : String(error),
          );
        },
      });
    } catch (error) {
      this.logger.error(
        'Error attempting to emit email message',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
