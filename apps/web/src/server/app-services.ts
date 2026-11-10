import "server-only";
import { createAuthService, type AuthService } from "./auth/auth-service";
import { createCheckoutService, type CheckoutService } from "./checkout/checkout-service";
import { serverConfig } from "./config";
import { createDatabase } from "./database";
import { createEmailDelivery } from "./email/create-email-delivery";
import { createOutboxSender, type OutboxSender } from "./notifications/outbox-sender";
import {
  createPayoutAddressService,
  type PayoutAddressService,
} from "./payout-addresses/payout-address-service";
import { createRequestService, type RequestService } from "./requests/request-service";
import { createHorizonAccountReader } from "./stellar/horizon-account-reader";
import { createUseroutrGateway } from "./useroutr/useroutr-gateway";
import { createWebhookService, type WebhookService } from "./webhooks/webhook-service";

interface AppServices {
  auth: AuthService;
  payoutAddresses: PayoutAddressService;
  requests: RequestService;
  checkout: CheckoutService;
  webhooks: WebhookService;
  outbox: OutboxSender;
}

declare global {
  // Next's dev server evaluates server modules again after an edit. Kept on
  // globalThis, the services, and the database pool with them, survive it
  // instead of opening another pool each time.
  var pomiAppServices: AppServices | undefined;
}

function appServices(): AppServices {
  if (globalThis.pomiAppServices === undefined) {
    const config = serverConfig();
    const database = createDatabase(config.databaseUrl);
    const emailDelivery = createEmailDelivery(config.email);
    const useroutr = createUseroutrGateway({
      apiKey: config.useroutr.apiKey,
      apiUrl: config.useroutr.apiUrl,
      webhookSecret: config.useroutr.webhookSecret,
    });
    const payoutAddresses = createPayoutAddressService({
      database,
      accountReader: createHorizonAccountReader({ horizonUrl: config.stellar.horizonUrl }),
      network: config.stellar.network,
    });
    globalThis.pomiAppServices = {
      auth: createAuthService({ database, emailDelivery, authSecret: config.authSecret }),
      payoutAddresses,
      requests: createRequestService({ database, useroutr, payoutAddresses }),
      checkout: createCheckoutService({ database, useroutr }),
      webhooks: createWebhookService({ database, useroutr }),
      outbox: createOutboxSender({
        database,
        emailDelivery,
        useroutr,
        appUrl: config.appUrl,
        network: config.stellar.network,
      }),
    };
  }
  return globalThis.pomiAppServices;
}

export const authService = () => appServices().auth;
export const payoutAddressService = () => appServices().payoutAddresses;
export const requestService = () => appServices().requests;
export const checkoutService = () => appServices().checkout;
export const webhookService = () => appServices().webhooks;
export const outboxSender = () => appServices().outbox;
