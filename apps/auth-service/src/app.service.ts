import { Inject, Injectable } from '@nestjs/common';
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
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new RpcException({
        status: 400,
        message: 'Email already in use',
      });
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
      isTwoFactorEnabled: true, // 2FA enabled by default
    });

    await this.userRepo.save(user);

    // Fire and forget - emit the message instead of waiting
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

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.password) {
      throw new RpcException({
        status: 401,
        message: 'Invalid credentials',
      });
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new RpcException({
        status: 401,
        message: 'Invalid credentials',
      });
    }

    if (!user.isEmailVerified) {
      throw new RpcException({
        status: 401,
        message: 'Email not verified',
      });
    }

    // Always send OTP on login (2FA is enabled by default)
    const code = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    const key = `2fa:${user.id}`;
    await this.cacheManager.set(key, code, 300 * 1000); // 5 mins in milliseconds

    // Store user info temporarily for OTP verification
    // This ensures we can verify the user exists and password was correct
    const loginSessionKey = `login:${user.id}`;
    await this.cacheManager.set(
      loginSessionKey,
      {
        userId: user.id,
        email: user.email,
        verified: false,
      },
      300 * 1000, // 5 mins - same as OTP expiry
    );

    // Fire and forget - emit the message instead of waiting
    const emailContext = {
      name: user.name,
      code: code,
    };
    console.log(
      `[2FA CODE] Sending email to ${user.email} with context:`,
      JSON.stringify(emailContext),
    );

    this.sendEmail({
      to: user.email,
      subject: 'Your 2FA Code',
      template: '2fa-code',
      context: emailContext,
    });

    // Always return requires2FA: true and userId - tokens will be provided after OTP verification
    return {
      requires2FA: true,
      userId: user.id,
    };
  }

  async verify2FA(userId: string, code: string) {
    // Verify OTP code
    const key = `2fa:${userId}`;
    const storedCode = await this.cacheManager.get<string>(key);
    if (!storedCode || storedCode !== code) {
      throw new RpcException({
        status: 401,
        message: 'Invalid or expired 2FA code',
      });
    }

    // Check if login session exists (ensures user went through login flow)
    const loginSessionKey = `login:${userId}`;
    const loginSession = await this.cacheManager.get<any>(loginSessionKey);
    if (!loginSession) {
      throw new RpcException({
        status: 401,
        message: 'Login session expired. Please login again.',
      });
    }

    // Clean up OTP and login session
    await this.cacheManager.del(key);
    await this.cacheManager.del(loginSessionKey);

    // Get user from database
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new RpcException({
        status: 401,
        message: 'User not found',
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store user session in Redis for gateway authentication
    // Session key: session:{accessToken} or session:{userId}
    // Store user info that gateway needs for authorization
    const sessionKey = `session:${user.id}`;
    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      accessToken: tokens.accessToken,
      createdAt: new Date().toISOString(),
    };

    // Store session for 15 minutes (same as access token expiry)
    // Gateway can extend this on each authenticated request
    await this.cacheManager.set(sessionKey, sessionData, 15 * 60 * 1000);

    // Also store reverse lookup: accessToken -> userId for quick validation
    const tokenKey = `token:${tokens.accessToken}`;
    await this.cacheManager.set(
      tokenKey,
      {
        userId: user.id,
        role: user.role,
      },
      15 * 60 * 1000,
    );

    return tokens;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepo.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new RpcException({
        status: 400,
        message: 'Invalid token',
      });
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

    // Fire and forget - emit the message instead of waiting
    this.sendEmail({
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
      throw new RpcException({
        status: 400,
        message: 'Invalid token',
      });
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
        isTwoFactorEnabled: true, // 2FA enabled by default
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
      // Ensure 2FA is enabled for existing users too
      if (!user.isTwoFactorEnabled) user.isTwoFactorEnabled = true;
    }

    await this.userRepo.save(user);

    // For social login, we still need 2FA - send OTP
    const code = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    // Log the 2FA code to console for debugging
    console.log(`[2FA CODE - Social Login] User: ${user.email}, Code: ${code}`);
    console.log(
      `[2FA CODE - Social Login] Storing code for userId: ${user.id}`,
    );

    const key = `2fa:${user.id}`;
    await this.cacheManager.set(key, code, 300 * 1000); // 5 mins

    // Store login session
    const loginSessionKey = `login:${user.id}`;
    await this.cacheManager.set(
      loginSessionKey,
      {
        userId: user.id,
        email: user.email,
        verified: false,
      },
      300 * 1000,
    );

    // Send OTP email
    const emailContext = {
      name: user.name,
      code: code,
    };
    console.log(
      `[2FA CODE - Social Login] Sending email to ${user.email} with context:`,
      JSON.stringify(emailContext),
    );

    this.sendEmail({
      to: user.email,
      subject: 'Your 2FA Code',
      template: '2fa-code',
      context: emailContext,
    });

    // Return requires2FA like regular login
    return {
      requires2FA: true,
      userId: user.id,
    };
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

  // Method to invalidate session (logout)
  async invalidateSession(accessToken: string): Promise<void> {
    try {
      const decoded = (await this.jwtService.verifyAsync(accessToken)) as any;
      const userId = decoded.sub;

      const tokenKey = `token:${accessToken}`;
      const sessionKey = `session:${userId}`;

      await this.cacheManager.del(tokenKey);
      await this.cacheManager.del(sessionKey);
    } catch {
      // Ignore errors on logout
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Validate refresh token
      const decoded = (await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret,
      })) as any;

      const { sub: userId, jti } = decoded;
      const key = `refresh:${userId}:${jti}`;
      const exists = await this.cacheManager.get<string>(key);
      if (!exists) {
        throw new RpcException({
          status: 401,
          message: 'Invalid refresh token',
        });
      }

      // Get user from database
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new RpcException({
          status: 401,
          message: 'User not found',
        });
      }

      // Always generate a new access token (short-lived, should be regenerated)
      const payload = {
        sub: user.id,
        role: user.role,
        email: user.email,
      };
      const accessToken = await this.jwtService.signAsync(payload);

      // Store new access token in session
      const sessionKey = `session:${userId}`;
      const sessionData = {
        userId: user.id,
        email: user.email,
        role: user.role,
        accessToken: accessToken,
        createdAt: new Date().toISOString(),
      };
      await this.cacheManager.set(sessionKey, sessionData, 15 * 60 * 1000);

      // Store reverse lookup for access token validation
      const tokenKey = `token:${accessToken}`;
      await this.cacheManager.set(
        tokenKey,
        {
          userId: user.id,
          role: user.role,
        },
        15 * 60 * 1000,
      );

      // Return only the new access token (refresh token remains unchanged)
      return { accessToken };
    } catch (err: any) {
      if (err instanceof RpcException) {
        throw err;
      }
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

  private sendEmail(payload: {
    to: string;
    subject: string;
    template: string;
    context: any;
  }): void {
    try {
      // Ensure context is included in the payload
      const emailPayload = {
        to: payload.to,
        subject: payload.subject,
        template: payload.template,
        context: payload.context || {}, // Ensure context is always an object
      };

      this.emailClient.emit({ cmd: 'send_email' }, emailPayload).subscribe({
        next: () => {
          console.log(`Email message successfully emitted`);
        },
        error: (err) => {
          console.error('Failed to emit email message to email service:', err);
        },
      });
    } catch (err) {
      console.error('Error attempting to emit email message:', err);
    }
  }
}
