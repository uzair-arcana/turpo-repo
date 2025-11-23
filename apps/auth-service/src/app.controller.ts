import { Controller } from '@nestjs/common';
import { AppService } from './app.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LoginDTO } from '@shared/dtos/auth/login-request.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'auth.login' })
  async login(@Payload() credentials: LoginDTO) {
    return this.appService.login(credentials);
  }
}
