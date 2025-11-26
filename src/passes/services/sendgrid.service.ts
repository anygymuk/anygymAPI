import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sgMail = require('@sendgrid/mail');

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
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

      await sgMail.send(msg);
      this.logger.log(`Pass email sent successfully to ${data.to}`);
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`, error.stack);
      // Re-throw so caller can handle it (they'll catch and log without failing the request)
      throw error;
    }
  }

  async sendWelcomeEmail(data: {
    to: string;
    recipientName: string;
    membershipName: string;
    gym1?: {
      name: string;
      address: string;
      postcode: string;
      city: string;
      url: string;
      image: string;
    };
    gym2?: {
      name: string;
      address: string;
      postcode: string;
      city: string;
      url: string;
      image: string;
    };
    gym3?: {
      name: string;
      address: string;
      postcode: string;
      city: string;
      url: string;
      image: string;
    };
    isNewCustomer: boolean;
  }): Promise<void> {
    try {
      const templateId = data.isNewCustomer
        ? 'd-d31148c503f543dda5ef29beb5bcd30b'
        : 'd-e38fefb021e84d0a9a427f2c7b11a397';

      const dynamicTemplateData: any = {
        Recipient_Name: data.recipientName,
        Membership_Name: data.membershipName,
      };

      // Add gym data if available
      if (data.gym1) {
        dynamicTemplateData.Gym_1_Name = data.gym1.name;
        dynamicTemplateData.Gym_1_Address = data.gym1.address;
        dynamicTemplateData.Gym_1_Postcode = data.gym1.postcode;
        dynamicTemplateData.Gym_1_City = data.gym1.city;
        dynamicTemplateData.Gym_1_Url = data.gym1.url;
        dynamicTemplateData.Gym_1_Image = data.gym1.image;
      }

      if (data.gym2) {
        dynamicTemplateData.Gym_2_Name = data.gym2.name;
        dynamicTemplateData.Gym_2_Address = data.gym2.address;
        dynamicTemplateData.Gym_2_Postcode = data.gym2.postcode;
        dynamicTemplateData.Gym_2_City = data.gym2.city;
        dynamicTemplateData.Gym_2_Url = data.gym2.url;
        dynamicTemplateData.Gym_2_Image = data.gym2.image;
      }

      if (data.gym3) {
        dynamicTemplateData.Gym_3_Name = data.gym3.name;
        dynamicTemplateData.Gym_3_Address = data.gym3.address;
        dynamicTemplateData.Gym_3_Postcode = data.gym3.postcode;
        dynamicTemplateData.Gym_3_City = data.gym3.city;
        dynamicTemplateData.Gym_3_Url = data.gym3.url;
        dynamicTemplateData.Gym_3_Image = data.gym3.image;
      }

      const msg = {
        to: data.to,
        from: 'naaman@any-gym.com',
        templateId,
        dynamicTemplateData,
      };

      await sgMail.send(msg);
      this.logger.log(`Welcome email sent successfully to ${data.to}`);
    } catch (error) {
      this.logger.error(`Error sending welcome email: ${error.message}`, error.stack);
      throw error;
    }
  }
}

