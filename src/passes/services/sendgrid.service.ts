import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      // @sendgrid/mail is a CommonJS module, so we need to access the default export
      const mail = sgMail.default || sgMail;
      mail.setApiKey(apiKey);
    } else {
      this.logger.warn('SENDGRID_API_KEY not set in environment variables');
    }
  }

  async sendPassEmail(data: {
    to: string;
    recipientName: string;
    gymName: string;
    passQr: string;
    passCode: string;
    gymAddress: string;
    gymPostcode: string;
    gymCity: string;
    gymLng: number;
    gymLat: number;
  }): Promise<void> {
    try {
      const msg = {
        to: data.to,
        from: 'naaman@any-gym.com',
        templateId: 'd-af64b6e942394f2e833c29abb7258c4f',
        dynamicTemplateData: {
          Recipient_Name: data.recipientName,
          Gym_Name: data.gymName,
          Pass_QR: data.passQr,
          Pass_Code: data.passCode,
          Gym_Address: data.gymAddress,
          Gym_Postcode: data.gymPostcode,
          Gym_City: data.gymCity,
          Gym_Lng: data.gymLng,
          Gym_Lat: data.gymLat,
        },
      };

      // @sendgrid/mail is a CommonJS module, so we need to access the default export
      const mail = sgMail.default || sgMail;
      await mail.send(msg);
      this.logger.log(`Pass email sent successfully to ${data.to}`);
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`, error.stack);
      // Re-throw so caller can handle it (they'll catch and log without failing the request)
      throw error;
    }
  }
}

