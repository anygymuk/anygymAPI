import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  PassEmailTemplateData,
  PASS_EMAIL_TEMPLATE_ID,
  buildPassEmailSubject,
  toPassEmailTemplateVariables,
} from './templates/pass-email.template';
import {
  NewUserEmailTemplateData,
  NEW_USER_EMAIL_TEMPLATE_ID,
  buildNewUserEmailSubject,
  toNewUserEmailTemplateVariables,
} from './templates/new-user.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY not set — pass emails will be skipped');
    }

    this.fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Info <info@app.any-gym.com>';
  }

  isConfigured(): boolean {
    return this.resend !== null;
  }

  async sendPassEmail(data: PassEmailTemplateData & { to: string }): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend is not configured');
    }

    const { to, ...templateData } = data;

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: buildPassEmailSubject(templateData.gym_name),
        template: {
          id: PASS_EMAIL_TEMPLATE_ID,
          variables: toPassEmailTemplateVariables(templateData),
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.logger.log(
        `Pass email sent successfully to ${to} using template "${PASS_EMAIL_TEMPLATE_ID}"`,
      );
    } catch (error) {
      this.logger.error(`Error sending pass email: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendNewUserEmail(data: NewUserEmailTemplateData & { to: string }): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend is not configured');
    }

    const { to, ...templateData } = data;
    const variables = toNewUserEmailTemplateVariables(templateData);

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: buildNewUserEmailSubject(templateData.membership_name),
        template: {
          id: NEW_USER_EMAIL_TEMPLATE_ID,
          variables,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.logger.log(
        `New user email sent successfully to ${to} using template "${NEW_USER_EMAIL_TEMPLATE_ID}" (gym_1_image=${variables.gym_1_image || 'empty'})`,
      );
    } catch (error) {
      this.logger.error(`Error sending new user email: ${error.message}`, error.stack);
      throw error;
    }
  }
}
