import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sgMail = require('@sendgrid/mail');
import { EmailService } from '../../email/email.service';
import {
  buildGymGroupNotificationBody,
  buildInvestorNotificationBody,
  buildNewsletterNotificationBody,
  GYM_GROUP_NOTIFICATION_SUBJECT,
  INVESTOR_NOTIFICATION_SUBJECT,
  NEWSLETTER_NOTIFICATION_SUBJECT,
} from './lead-notification-body.utils';

@Injectable()
export class LeadsEmailService {
  private readonly logger = new Logger(LeadsEmailService.name);
  private readonly sendGridConfigured: boolean;

  constructor(private readonly emailService: EmailService) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.sendGridConfigured = true;
    } else {
      this.logger.warn('SENDGRID_API_KEY not set — investor pack emails will be skipped');
      this.sendGridConfigured = false;
    }
  }

  isInternalNotificationConfigured(): boolean {
    return this.emailService.isInternalNotificationConfigured();
  }

  isInvestorPackConfigured(): boolean {
    return this.sendGridConfigured;
  }

  async sendNewsletterNotification(email: string): Promise<void> {
    if (!this.isInternalNotificationConfigured()) {
      return;
    }

    await this.emailService.sendInternalNotification({
      notification_subject: NEWSLETTER_NOTIFICATION_SUBJECT,
      notification_body: buildNewsletterNotificationBody(email),
    });
    this.logger.log('Newsletter notification email sent');
  }

  async sendGymGroupNotification(data: {
    contactName: string;
    email: string;
    companyName: string;
    locations: string;
    phone?: string;
    message?: string;
  }): Promise<void> {
    if (!this.isInternalNotificationConfigured()) {
      return;
    }

    await this.emailService.sendInternalNotification({
      notification_subject: GYM_GROUP_NOTIFICATION_SUBJECT,
      notification_body: buildGymGroupNotificationBody(data),
    });
    this.logger.log('Gym group notification email sent');
  }

  async sendInvestorNotification(data: {
    fullName: string;
    email: string;
    company?: string;
    investmentRange?: string;
    message?: string;
  }): Promise<void> {
    if (!this.isInternalNotificationConfigured()) {
      return;
    }

    await this.emailService.sendInternalNotification({
      notification_subject: INVESTOR_NOTIFICATION_SUBJECT,
      notification_body: buildInvestorNotificationBody(data),
    });
    this.logger.log('Investor notification email sent');
  }

  async sendInvestorPack(to: string, fullName: string): Promise<void> {
    if (!this.sendGridConfigured) {
      return;
    }

    const from = this.getFromEmail();
    await sgMail.send({
      to,
      from,
      subject: 'AnyGym investor information',
      text: [
        `Hi ${fullName},`,
        '',
        'Thank you for your interest in AnyGym.',
        '',
        'Our team will be in touch shortly with our investor pack and next steps.',
        '',
        'Best regards,',
        'The AnyGym Team',
      ].join('\n'),
    });
    this.logger.log('Investor pack email sent');
  }

  private getFromEmail(): string {
    return process.env.SENDGRID_FROM_EMAIL ?? 'naaman@any-gym.com';
  }
}
