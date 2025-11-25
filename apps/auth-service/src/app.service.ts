import {
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as otpGenerator from 'otp-generator';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { User, UserRole } from '@shared/entities/user.entity';
import { LoginDto, SignupDto, ENV, SERVICES } from '@shared';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AppService {
  private readonly refreshSecret: string;
  private readonly refreshTtlSeconds: number;

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

  async signup(dto: SignupDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const emailVerificationToken = uuidv4();

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      password: hashed,
      name: dto.name,
      role: dto.role || UserRole.CLIENT,
      isEmailVerified: false,
      emailVerificationToken,
      connects: dto.role === UserRole.FREELANCER ? 60 : null,
    });

    await this.userRepo.save(user);

    await this.sendEmail({
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

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    if (user.isTwoFactorEnabled) {
      const code = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      const key = `2fa:${user.id}`;
      await this.cacheManager.set(key, code, 300 * 1000); // 5 mins in milliseconds

      await this.sendEmail({
        to: user.email,
        subject: 'Your 2FA Code',
        template: '2fa-code',
        context: {
          name: user.name,
          code,
        },
      });

      return {
        requires2FA: true,
        userId: user.id,
      };
    }

    const tokens = await this.generateTokens(user);
    return { requires2FA: false, ...tokens };
  }

  async verify2FA(userId: string, code: string) {
    const key = `2fa:${userId}`;
    const storedCode = await this.cacheManager.get<string>(key);
    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException('Invalid or expired 2FA code');
    }

    await this.cacheManager.del(key);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(user);
    return tokens;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepo.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    await this.userRepo.save(user);

    return { message: 'Email verified successfully' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // do not leak user existence
      return { message: 'If that email exists, a reset link was sent' };
    }

    const token = uuidv4();
    user.forgotPasswordToken = token;
    await this.userRepo.save(user);

    await this.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      template: 'reset-password',
      context: {
        name: user.name,
        token,
      },
    });

    return { message: 'If that email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepo.findOne({
      where: { forgotPasswordToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid token');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.forgotPasswordToken = null;

    await this.userRepo.save(user);

    return { message: 'Password updated successfully' };
  }

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
        googleId: provider === 'google' ? googleId : null,
        appleId: provider === 'apple' ? appleId : null,
      });
    } else {
      if (provider === 'google' && !user.googleId) {
        user.googleId = googleId || null;
      }
      if (provider === 'apple' && !user.appleId) {
        user.appleId = appleId || null;
      }
      if (!user.isEmailVerified) user.isEmailVerified = true;
    }

    await this.userRepo.save(user);

    const tokens = await this.generateTokens(user);
    return tokens;
  }

  private async generateTokens(user: User): Promise<Tokens> {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const jti = uuidv4();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      },
    );

    const key = `refresh:${user.id}:${jti}`;
    await this.cacheManager.set(key, '1', this.refreshTtlSeconds * 1000); // Convert seconds to milliseconds

    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<Tokens> {
    try {
      const decoded = (await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      })) as any;

      const { sub: userId, jti } = decoded;
      const key = `refresh:${userId}:${jti}`;
      const exists = await this.cacheManager.get<string>(key);
      if (!exists) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Rotation: invalidate old token
      await this.cacheManager.del(key);

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async sendEmail(payload: {
    to: string;
    subject: string;
    template: string;
    context: any;
  }) {
    try {
      return await firstValueFrom(
        this.emailClient.send({ cmd: 'send_email' }, payload),
      );
    } catch (err) {
      // In real app, log; don't throw here so auth still works even if email fails
      return err;
    }
  }
}
