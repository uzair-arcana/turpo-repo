import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { ENV } from '@shared';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly sesClient: SESClient;

  constructor() {
    // Use AWS SDK's default credential provider chain if credentials are not explicitly provided
    // This checks: environment variables -> credentials file -> IAM role (EC2/ECS/Lambda)
    const config: any = {
      region: ENV.AWS_REGION,
    };

    // Only provide explicit credentials if both are set and not empty
    if (ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY &&
      ENV.AWS_ACCESS_KEY_ID.trim() !== '' && ENV.AWS_SECRET_ACCESS_KEY.trim() !== '') {
      config.credentials = {
        accessKeyId: ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
      };
      this.logger.log('Using explicit AWS credentials from environment variables');
    } else {
      this.logger.warn('AWS credentials not provided in environment. Using default credential provider chain (env vars, credentials file, or IAM role)');
    }

    this.sesClient = new SESClient(config);
  }

  async sendEmail(payload: {
    to: string;
    subject: string;
    template: string;
    context?: Record<string, any>;
  }) {
    this.logger.log(`Sending email to=${payload.to} subject=${payload.subject} template=${payload.template}`);
    this.logger.log(`Email context: ${JSON.stringify(payload.context || {})}`);

    try {
      // Build full URLs for email templates if token is provided
      const context = { ...payload.context };
      if (context.token && !context.verifyUrl && !context.resetUrl) {
        // Determine URL type based on template
        if (payload.template === 'verify-email') {
          context.verifyUrl = `${ENV.FRONTEND_URL}/auth/verify-email?token=${context.token}`;
        } else if (payload.template === 'reset-password') {
          context.resetUrl = `${ENV.FRONTEND_URL}/auth/reset-password?token=${context.token}`;
        }
      }

      // Log context for 2FA template
      if (payload.template === '2fa-code') {
        console.log(`[EMAIL SERVICE] 2FA Code Email Context:`, JSON.stringify(context));
        console.log(`[EMAIL SERVICE] Code value: ${context.code}`);
      }

      const html = this.renderTemplate(payload.template, context);

      // Log rendered HTML snippet for 2FA code (last 500 chars to see if code is there)
      if (payload.template === '2fa-code') {
        const htmlSnippet = html.substring(Math.max(0, html.length - 500));
        console.log(`[EMAIL SERVICE] Rendered HTML snippet (last 500 chars):`, htmlSnippet);
        // Check if code is in HTML
        if (html.includes(context.code || '')) {
          console.log(`[EMAIL SERVICE] ✓ Code found in rendered HTML`);
        } else {
          console.log(`[EMAIL SERVICE] ✗ Code NOT found in rendered HTML!`);
          console.log(`[EMAIL SERVICE] Expected code: ${context.code}`);
        }
      }

      const command = new SendEmailCommand({
        Source: `"${ENV.AWS_SES_FROM_NAME}" <${ENV.AWS_SES_FROM_EMAIL}>`,
        Destination: {
          ToAddresses: [payload.to],
        },
        Message: {
          Subject: {
            Data: payload.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await this.sesClient.send(command);
      this.logger.log(`Email sent successfully. MessageId: ${result.MessageId}`);

      return { success: true, messageId: result.MessageId };
    } catch (err: any) {
      this.logger.error('Failed to send email', err);

      if (err.name === 'TemplateDoesNotExist') {
        this.logger.error(`Email template '${payload.template}' not found`);
        return { success: false, error: `Email template '${payload.template}' not found` };
      }

      // For fire-and-forget (emit), we log errors but don't throw RpcException
      // This prevents email failures from breaking the auth service
      // Errors are logged for monitoring but don't propagate

      if (err.name === 'InvalidClientTokenId' || err.name === 'SignatureDoesNotMatch' || err.code === 'CredentialsError') {
        this.logger.error(
          'AWS credentials error. Email not sent. Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
        );
        // Return error instead of throwing for resilience
        return { success: false, error: 'AWS credentials invalid or missing' };
      }

      if (err.name === 'MessageRejected' || err.name === 'InvalidParameterValue') {
        this.logger.error(`Invalid email parameters: ${err.message}`);
        return { success: false, error: `Invalid email parameters: ${err.message}` };
      }

      this.logger.error(`Email sending failed: ${err.message || 'Unknown error'}`);
      return { success: false, error: err.message || 'Failed to send email' };
    }
  }

  private renderTemplate(templateName: string, context: Record<string, any>): string {
    const templatesDir = path.join(__dirname, '..', 'templates');
    const filePath = path.join(templatesDir, `${templateName}.html`);

    if (!fs.existsSync(filePath)) {
      const error = new Error(`Template not found: ${templateName}`);
      (error as any).name = 'TemplateDoesNotExist';
      throw error;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Log template replacement for debugging
    if (templateName === '2fa-code') {
      console.log(`[EMAIL SERVICE] Template file path: ${filePath}`);
      console.log(`[EMAIL SERVICE] Context keys: ${Object.keys(context).join(', ')}`);
      console.log(`[EMAIL SERVICE] Context values:`, context);
    }

    // Very small and safe replacement engine: replace {{key}} with value
    content = content.replace(/{{\s*([^}]+)\s*}}/g, (_m, key) => {
      const trimmedKey = key.trim();
      const val = trimmedKey
        .split('.')
        .reduce((acc: any, k: string) => (acc ? acc[k] : ''), context as any);
      const result = typeof val === 'undefined' || val === null ? '' : String(val);

      // Log replacements for 2FA code
      if (templateName === '2fa-code' && trimmedKey === 'code') {
        console.log(`[EMAIL SERVICE] Replacing {{${trimmedKey}}} with: ${result}`);
      }

      return result;
    });

    // Verify code was replaced
    if (templateName === '2fa-code') {
      if (content.includes('{{code}}')) {
        console.log(`[EMAIL SERVICE] ✗ WARNING: {{code}} placeholder still present in rendered HTML!`);
      } else if (context.code && !content.includes(context.code)) {
        console.log(`[EMAIL SERVICE] ✗ WARNING: Code value not found in rendered HTML!`);
        console.log(`[EMAIL SERVICE] Expected: ${context.code}`);
      } else {
        console.log(`[EMAIL SERVICE] ✓ Template rendering successful`);
      }
    }

    return content;
  }
}
