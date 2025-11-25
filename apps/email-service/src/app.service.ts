import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  async sendEmail(payload: {
    to: string;
    subject: string;
    template: string;
    context?: Record<string, any>;
  }) {
    this.logger.log('Payload', payload);

    try {
      const html = this.renderTemplate(payload.template, payload.context || {});

      // TODO: integrate real email transport (nodemailer / sendgrid) here.
      // For now we'll log the email and pretend it's sent.
      this.logger.log(
        `Sending email to=${payload.to} subject=${payload.subject}`,
      );
      this.logger.debug(`Rendered HTML: ${html}`);

      return { success: true };
    } catch (err) {
      this.logger.error('Failed to send email', err as any);
      return { success: false };
    }
  }

  private renderTemplate(templateName: string, context: Record<string, any>) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    const filePath = path.join(templatesDir, `${templateName}.html`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Template not found: ${templateName}`);
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Very small and safe replacement engine: replace {{key}} with value
    content = content.replace(/{{\s*([^}]+)\s*}}/g, (_m, key) => {
      const val = key
        .split('.')
        .reduce((acc: any, k: string) => (acc ? acc[k] : ''), context as any);
      return typeof val === 'undefined' || val === null ? '' : String(val);
    });

    return content;
  }
}
