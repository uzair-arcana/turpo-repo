import { Body, Controller, Inject, Post, Version } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AUTH_PATTERNS, LoginDTO, SERVICES } from '@shared';
import { firstValueFrom } from 'rxjs';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(SERVICES.AUTH) private readonly authClient: ClientProxy
  ) {}

  @Post('login')
  @Version('1')
  async login(@Body() loginDto: LoginDTO) {
    return await firstValueFrom<unknown>(
      this.authClient.send({ cmd: AUTH_PATTERNS.LOGIN }, loginDto)
    );
  }
}
