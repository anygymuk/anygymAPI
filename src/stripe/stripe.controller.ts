import {
  Controller,
  Post,
  Req,
  Res,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);
  private stripe: Stripe;

  constructor(private readonly stripeService: StripeService) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    }
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_CHECKOUT_WEBHOOK;

    if (!sig || !webhookSecret) {
      this.logger.error('Missing stripe-signature header or webhook secret');
      return res.status(400).send('Webhook signature missing');
    }

    let event: Stripe.Event;

    try {
      // req.body is a Buffer when using express.raw() middleware
      const body = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        body,
        sig as string,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      try {
        await this.stripeService.handleCheckoutSessionCompleted(session);
        this.logger.log(`Successfully processed checkout session: ${session.id}`);
      } catch (error) {
        this.logger.error(
          `Error processing checkout session: ${error.message}`,
          error.stack,
        );
        // Return 200 to acknowledge receipt, but log the error
        // Stripe will retry if we return non-200
        return res.status(200).json({ received: true, error: error.message });
      }
    } else {
      this.logger.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  }

  @Post('updates')
  @HttpCode(HttpStatus.OK)
  async handleUpdatesWebhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_UPDATES_WEBHOOK || process.env.STRIPE_CHECKOUT_WEBHOOK;

    if (!sig || !webhookSecret) {
      this.logger.error('Missing stripe-signature header or webhook secret');
      return res.status(400).send('Webhook signature missing');
    }

    let event: Stripe.Event;

    try {
      // req.body is a Buffer when using express.raw() middleware
      const body = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        body,
        sig as string,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      
      try {
        await this.stripeService.handleSubscriptionUpdated(subscription);
        this.logger.log(`Successfully processed subscription update: ${subscription.id}`);
      } catch (error) {
        this.logger.error(
          `Error processing subscription update: ${error.message}`,
          error.stack,
        );
        // Return 200 to acknowledge receipt, but log the error
        // Stripe will retry if we return non-200
        return res.status(200).json({ received: true, error: error.message });
      }
    } else {
      this.logger.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  }
}

