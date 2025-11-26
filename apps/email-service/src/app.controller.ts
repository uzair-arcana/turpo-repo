import { Controller, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';
import { EmailDto } from '@shared';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) { }

  // Handle both send() (request-response) and emit() (fire-and-forget) messages
  @MessagePattern({ cmd: 'send_email' })
  @EventPattern({ cmd: 'send_email' })
  @UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false, // Allow additional properties like context
  }))
  async handleSendEmail(@Payload() payload: EmailDto) {
    try {
      // Log the raw payload to see what we're receiving
      this.logger.log(`Received email payload: ${JSON.stringify(payload)}`);

      // payload: { to, subject, template, context }
      return await this.appService.sendEmail(payload);
    } catch (error: any) {
      // Log the error but don't throw for emit() calls (fire-and-forget)
      // This ensures email failures don't break the auth flow
      this.logger.error(`Failed to send email: ${error.message || error}`, error.stack);

      // Return error response instead of throwing
      // This allows the service to continue operating even when emails fail
      return { success: false, error: error.message || 'Email sending failed' };
    }
  }

  @MessagePattern({ cmd: 'email_health_check' })
  healthCheck() {
    return { status: 'ok' };
  }
}
