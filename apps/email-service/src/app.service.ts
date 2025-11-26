import { Injectable, Logger } from '@nestjs/common';
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
    if (
      ENV.AWS_ACCESS_KEY_ID &&
      ENV.AWS_SECRET_ACCESS_KEY &&
      ENV.AWS_ACCESS_KEY_ID.trim() !== '' &&
      ENV.AWS_SECRET_ACCESS_KEY.trim() !== ''
    ) {
      config.credentials = {
        accessKeyId: ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.sesClient = new SESClient(config);
  }

  async sendEmail(payload: {
    to: string;
    subject: string;
    template: string;
    context?: Record<string, any>;
  }) {
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

      const html = this.renderTemplate(payload.template, context);

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

      return { success: true, messageId: result.MessageId };
    } catch (err: any) {
      this.logger.error('Failed to send email', err);

      if (err.name === 'TemplateDoesNotExist') {
        this.logger.error(`Email template '${payload.template}' not found`);
        return {
          success: false,
          error: `Email template '${payload.template}' not found`,
        };
      }

      // For fire-and-forget (emit), we log errors but don't throw RpcException
      // This prevents email failures from breaking the auth service
      // Errors are logged for monitoring but don't propagate

      if (
        err.name === 'InvalidClientTokenId' ||
        err.name === 'SignatureDoesNotMatch' ||
        err.code === 'CredentialsError'
      ) {
        return { success: false, error: 'AWS credentials invalid or missing' };
      }

      if (
        err.name === 'MessageRejected' ||
        err.name === 'InvalidParameterValue'
      ) {
        return {
          success: false,
          error: `Invalid email parameters: ${err.message}`,
        };
      }

      return { success: false, error: err.message || 'Failed to send email' };
    }
  }

  private renderTemplate(
    templateName: string,
    context: Record<string, any>,
  ): string {
    const templatesDir = path.join(__dirname, '..', 'templates');
    const filePath = path.join(templatesDir, `${templateName}.html`);

    if (!fs.existsSync(filePath)) {
      const error = new Error(`Template not found: ${templateName}`);
      (error as any).name = 'TemplateDoesNotExist';
      throw error;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Very small and safe replacement engine: replace {{key}} with value
    content = content.replace(/{{\s*([^}]+)\s*}}/g, (_m, key) => {
      const trimmedKey = key.trim();
      const val = trimmedKey
        .split('.')
        .reduce((acc: any, k: string) => (acc ? acc[k] : ''), context as any);
      const result =
        typeof val === 'undefined' || val === null ? '' : String(val);

      // Log replacements for 2FA code
      if (templateName === '2fa-code' && trimmedKey === 'code') {
        this.logger.debug(
          `[EMAIL SERVICE] Replacing {{${trimmedKey}}} with: ${result}`,
        );
      }

      return result;
    });

    // Verify code was replaced
    if (templateName === '2fa-code') {
      if (content.includes('{{code}}')) {
        this.logger.warn(
          `[EMAIL SERVICE] ✗ WARNING: {{code}} placeholder still present in rendered HTML!`,
        );
      } else if (context.code && !content.includes(context.code)) {
        this.logger.warn(
          `[EMAIL SERVICE] ✗ WARNING: Code value not found in rendered HTML!`,
        );
        this.logger.warn(`[EMAIL SERVICE] Expected: ${context.code}`);
      } else {
        this.logger.debug(`[EMAIL SERVICE] ✓ Template rendering successful`);
      }
    }

    return content;
  }
}
