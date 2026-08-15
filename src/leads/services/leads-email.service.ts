import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import {
  buildGymGroupNotificationBody,
  buildInvestorNotificationBody,
  buildNewsletterNotificationBody,
  GYM_GROUP_NOTIFICATION_SUBJECT,
  INVESTOR_NOTIFICATION_SUBJECT,
  NEWSLETTER_NOTIFICATION_SUBJECT,
} from './lead-notification-body.utils';
import {
  GYM_GROUP_CONFIRMATION_BODY,
  GYM_GROUP_CONFIRMATION_SUBJECT,
  INVESTOR_CONFIRMATION_BODY,
  INVESTOR_CONFIRMATION_SUBJECT,
  NEWSLETTER_CONFIRMATION_BODY,
  NEWSLETTER_CONFIRMATION_SUBJECT,
} from './lead-external-notification.utils';

@Injectable()
export class LeadsEmailService {
  private readonly logger = new Logger(LeadsEmailService.name);

  constructor(private readonly emailService: EmailService) {}

  isInternalNotificationConfigured(): boolean {
    return this.emailService.isInternalNotificationConfigured();
  }

  isExternalNotificationConfigured(): boolean {
    return this.emailService.isConfigured();
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

  async sendNewsletterConfirmation(to: string): Promise<void> {
    if (!this.isExternalNotificationConfigured()) {
      return;
    }

    await this.emailService.sendExternalNotification({
      to,
      notification_subject: NEWSLETTER_CONFIRMATION_SUBJECT,
      notification_body: NEWSLETTER_CONFIRMATION_BODY,
    });
    this.logger.log('Newsletter confirmation email sent');
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

  async sendGymGroupConfirmation(to: string): Promise<void> {
    if (!this.isExternalNotificationConfigured()) {
      return;
    }

    await this.emailService.sendExternalNotification({
      to,
      notification_subject: GYM_GROUP_CONFIRMATION_SUBJECT,
      notification_body: GYM_GROUP_CONFIRMATION_BODY,
    });
    this.logger.log('Gym group confirmation email sent');
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

  async sendInvestorConfirmation(to: string): Promise<void> {
    if (!this.isExternalNotificationConfigured()) {
      return;
    }

    await this.emailService.sendExternalNotification({
      to,
      notification_subject: INVESTOR_CONFIRMATION_SUBJECT,
      notification_body: INVESTOR_CONFIRMATION_BODY,
    });
    this.logger.log('Investor confirmation email sent');
  }
}
