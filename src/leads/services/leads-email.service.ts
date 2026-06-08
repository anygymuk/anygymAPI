import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sgMail = require('@sendgrid/mail');

@Injectable()
export class LeadsEmailService {
  private readonly logger = new Logger(LeadsEmailService.name);
  private readonly apiKeyConfigured: boolean;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.apiKeyConfigured = true;
    } else {
      this.logger.warn('SENDGRID_API_KEY not set — form emails will be skipped');
      this.apiKeyConfigured = false;
    }
  }

  isConfigured(): boolean {
    return this.apiKeyConfigured;
  }

  async sendNewsletterNotification(email: string): Promise<void> {
    const notificationEmail = process.env.FORM_NOTIFICATION_EMAIL;
    if (!this.apiKeyConfigured || !notificationEmail) {
      return;
    }

    const from = this.getFromEmail();
    await sgMail.send({
      to: notificationEmail,
      from,
      subject: 'New newsletter subscription',
      text: `A new newsletter subscription was received.\n\nEmail: ${email}`,
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
    const notificationEmail = process.env.FORM_NOTIFICATION_EMAIL;
    if (!this.apiKeyConfigured || !notificationEmail) {
      return;
    }

    const from = this.getFromEmail();
    const lines = [
      'A new gym group enquiry was received.',
      '',
      `Contact name: ${data.contactName}`,
      `Email: ${data.email}`,
      `Company: ${data.companyName}`,
      `Locations: ${data.locations}`,
    ];
    if (data.phone) lines.push(`Phone: ${data.phone}`);
    if (data.message) lines.push(`Message: ${data.message}`);

    await sgMail.send({
      to: notificationEmail,
      from,
      subject: `Gym group enquiry from ${data.companyName}`,
      text: lines.join('\n'),
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
    const notificationEmail = process.env.FORM_NOTIFICATION_EMAIL;
    if (!this.apiKeyConfigured || !notificationEmail) {
      return;
    }

    const from = this.getFromEmail();
    const lines = [
      'A new investor enquiry was received.',
      '',
      `Name: ${data.fullName}`,
      `Email: ${data.email}`,
    ];
    if (data.company) lines.push(`Company: ${data.company}`);
    if (data.investmentRange) lines.push(`Investment range: ${data.investmentRange}`);
    if (data.message) lines.push(`Message: ${data.message}`);

    await sgMail.send({
      to: notificationEmail,
      from,
      subject: `Investor enquiry from ${data.fullName}`,
      text: lines.join('\n'),
    });
    this.logger.log('Investor notification email sent');
  }

  async sendInvestorPack(to: string, fullName: string): Promise<void> {
    if (!this.apiKeyConfigured) {
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
