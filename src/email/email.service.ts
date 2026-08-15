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
import {
  InternalNotificationTemplateData,
  INTERNAL_NOTIFICATION_TEMPLATE_ID,
  buildInternalNotificationSubject,
  toInternalNotificationTemplateVariables,
} from './templates/internal-notification.template';
import {
  ExternalNotificationTemplateData,
  EXTERNAL_NOTIFICATION_TEMPLATE_ID,
  buildExternalNotificationSubject,
  toExternalNotificationTemplateVariables,
} from './templates/external-notification.template';

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

  isInternalNotificationConfigured(): boolean {
    return this.resend !== null && Boolean(process.env.FORM_NOTIFICATION_EMAIL);
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

  async sendInternalNotification(
    data: InternalNotificationTemplateData,
  ): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend is not configured');
    }

    const to = process.env.FORM_NOTIFICATION_EMAIL;
    if (!to) {
      throw new Error('FORM_NOTIFICATION_EMAIL is not configured');
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: buildInternalNotificationSubject(data.notification_subject),
        template: {
          id: INTERNAL_NOTIFICATION_TEMPLATE_ID,
          variables: toInternalNotificationTemplateVariables(data),
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.logger.log(
        `Internal notification sent successfully to ${to} using template "${INTERNAL_NOTIFICATION_TEMPLATE_ID}" (${data.notification_subject})`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending internal notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async sendExternalNotification(
    data: ExternalNotificationTemplateData & { to: string },
  ): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend is not configured');
    }

    const { to, ...templateData } = data;

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: buildExternalNotificationSubject(templateData.notification_subject),
        template: {
          id: EXTERNAL_NOTIFICATION_TEMPLATE_ID,
          variables: toExternalNotificationTemplateVariables(templateData),
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.logger.log(
        `External notification sent successfully to ${to} using template "${EXTERNAL_NOTIFICATION_TEMPLATE_ID}" (${templateData.notification_subject})`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending external notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
