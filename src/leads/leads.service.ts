import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NewsletterSubscription } from './entities/newsletter-subscription.entity';
import { GymGroupEnquiry } from './entities/gym-group-enquiry.entity';
import { InvestorEnquiry } from './entities/investor-enquiry.entity';
import { NewsletterDto } from './dto/newsletter.dto';
import { GymGroupDto } from './dto/gym-group.dto';
import { InvestorDto } from './dto/investor.dto';
import { FormSuccessResponseDto } from './dto/form-success-response.dto';
import { LeadsEmailService } from './services/leads-email.service';

const GENERIC_ERROR =
  'Something went wrong. Please try again or contact contact@any-gym.com';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(NewsletterSubscription)
    private readonly newsletterRepository: Repository<NewsletterSubscription>,
    @InjectRepository(GymGroupEnquiry)
    private readonly gymGroupRepository: Repository<GymGroupEnquiry>,
    @InjectRepository(InvestorEnquiry)
    private readonly investorRepository: Repository<InvestorEnquiry>,
    private readonly leadsEmailService: LeadsEmailService,
  ) {}

  async submitNewsletter(dto: NewsletterDto): Promise<FormSuccessResponseDto> {
    let saved = false;

    try {
      const existing = await this.newsletterRepository.findOne({
        where: { email: dto.email, unsubscribedAt: IsNull() },
      });

      if (!existing) {
        await this.newsletterRepository.save({
          email: dto.email,
          consent: dto.consent,
        });
        saved = true;
      } else {
        saved = true;
      }
    } catch (error) {
      if (error.code === '23505') {
        saved = true;
      } else {
        this.logger.error(`Newsletter DB error: ${error.message}`, error.stack);
        throw new InternalServerErrorException({ error: GENERIC_ERROR });
      }
    }

    let emailSent = false;
    if (this.leadsEmailService.isConfigured()) {
      try {
        await this.leadsEmailService.sendNewsletterNotification(dto.email);
        emailSent = true;
      } catch (error) {
        this.logger.error(
          `Newsletter email error: ${error.message}`,
          error.stack,
        );
      }
    }

    return { success: true, emailSent, saved };
  }

  async submitGymGroup(dto: GymGroupDto): Promise<FormSuccessResponseDto> {
    let saved = false;

    try {
      await this.gymGroupRepository.save({
        contactName: dto.contactName,
        email: dto.email,
        companyName: dto.companyName,
        locations: dto.locations,
        phone: dto.phone ?? null,
        message: dto.message ?? null,
      });
      saved = true;
    } catch (error) {
      this.logger.error(`Gym group DB error: ${error.message}`, error.stack);
      throw new InternalServerErrorException({ error: GENERIC_ERROR });
    }

    let emailSent = false;
    if (this.leadsEmailService.isConfigured()) {
      try {
        await this.leadsEmailService.sendGymGroupNotification(dto);
        emailSent = true;
      } catch (error) {
        this.logger.error(
          `Gym group email error: ${error.message}`,
          error.stack,
        );
      }
    }

    return { success: true, emailSent, saved };
  }

  async submitInvestor(dto: InvestorDto): Promise<FormSuccessResponseDto> {
    let packSent = false;
    let notificationSent = false;

    if (this.leadsEmailService.isConfigured()) {
      try {
        await this.leadsEmailService.sendInvestorPack(dto.email, dto.fullName);
        packSent = true;
      } catch (error) {
        this.logger.error(
          `Investor pack email error: ${error.message}`,
          error.stack,
        );
      }

      try {
        await this.leadsEmailService.sendInvestorNotification(dto);
        notificationSent = true;
      } catch (error) {
        this.logger.error(
          `Investor notification email error: ${error.message}`,
          error.stack,
        );
      }
    }

    let saved = false;
    try {
      await this.investorRepository.save({
        fullName: dto.fullName,
        email: dto.email,
        company: dto.company ?? null,
        investmentRange: dto.investmentRange ?? null,
        message: dto.message ?? null,
        investorPackSent: packSent,
      });
      saved = true;
    } catch (error) {
      this.logger.error(`Investor DB error: ${error.message}`, error.stack);
      throw new InternalServerErrorException({ error: GENERIC_ERROR });
    }

    const emailSent = packSent && notificationSent;
    if (this.leadsEmailService.isConfigured() && !emailSent) {
      throw new HttpException({ error: GENERIC_ERROR }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return { success: true, emailSent, saved };
  }
}
