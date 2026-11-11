import "server-only";
import { createAuthService, type AuthService } from "./auth/auth-service";
import { createCheckoutService, type CheckoutService } from "./checkout/checkout-service";
import { serverConfig } from "./config";
import { createDatabase, type Database } from "./database";
import { createEmailDelivery } from "./email/create-email-delivery";
import { createOutboxSender, type OutboxSender } from "./notifications/outbox-sender";
import {
  createPayoutAddressService,
  type PayoutAddressService,
} from "./payout-addresses/payout-address-service";
import { createProfileService, type ProfileService } from "./profiles/profile-service";
import { createExpoPushDelivery } from "./push/expo-push-delivery";
import { createRequestService, type RequestService } from "./requests/request-service";
import { createHorizonAccountReader } from "./stellar/horizon-account-reader";
import { createUseroutrGateway } from "./useroutr/useroutr-gateway";
import { createWebhookService, type WebhookService } from "./webhooks/webhook-service";

interface AppServices {
  auth: AuthService;
  profiles: ProfileService;
  payoutAddresses: PayoutAddressService;
  requests: RequestService;
  checkout: CheckoutService;
  webhooks: WebhookService;
  outbox: OutboxSender;
}

declare global {
  // Next's dev server evaluates server modules again after an edit. Kept on
  // globalThis, the database pool survives that instead of opening another
  // pool each time. The services are rebuilt, so edits to them take effect.
  var pomiDatabase: Database | undefined;
}

let services: AppServices | undefined;

function appServices(): AppServices {
  if (services === undefined) {
    const config = serverConfig();
    globalThis.pomiDatabase ??= createDatabase(config.databaseUrl);
    const database = globalThis.pomiDatabase;
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
    services = {
      auth: createAuthService({ database, emailDelivery, authSecret: config.authSecret }),
      profiles: createProfileService({ database }),
      payoutAddresses,
      requests: createRequestService({ database, useroutr, payoutAddresses }),
      checkout: createCheckoutService({ database, useroutr }),
      webhooks: createWebhookService({
        database,
        useroutr,
        alertsOperator: config.operatorEmail !== null,
      }),
      outbox: createOutboxSender({
        database,
        emailDelivery,
        pushDelivery: createExpoPushDelivery({ accessToken: config.expoAccessToken }),
        useroutr,
        appUrl: config.appUrl,
        network: config.stellar.network,
        operatorEmail: config.operatorEmail,
      }),
    };
  }
  return services;
}

export const authService = () => appServices().auth;
export const profileService = () => appServices().profiles;
export const payoutAddressService = () => appServices().payoutAddresses;
export const requestService = () => appServices().requests;
export const checkoutService = () => appServices().checkout;
export const webhookService = () => appServices().webhooks;
export const outboxSender = () => appServices().outbox;
