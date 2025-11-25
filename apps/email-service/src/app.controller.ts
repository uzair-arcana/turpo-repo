import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';
import { EmailDto } from '@shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'send_email' })
  async handleSendEmail(@Payload() payload: EmailDto) {
    // payload: { to, subject, template, context }
    await this.appService.sendEmail(payload);
    return { ok: true };
  }

  @MessagePattern({ cmd: 'email_health_check' })
  healthCheck() {
    return { status: 'ok' };
  }
}
