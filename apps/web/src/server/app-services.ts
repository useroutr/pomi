import "server-only";
import { createAuthService, type AuthService } from "./auth/auth-service";
import { serverConfig } from "./config";
import { createDatabase } from "./database";
import { createEmailDelivery } from "./email/create-email-delivery";
import {
  createPayoutAddressService,
  type PayoutAddressService,
} from "./payout-addresses/payout-address-service";
import { createRequestService, type RequestService } from "./requests/request-service";
import { createHorizonAccountReader } from "./stellar/horizon-account-reader";
import { createUseroutrGateway } from "./useroutr/useroutr-gateway";

interface AppServices {
  auth: AuthService;
  payoutAddresses: PayoutAddressService;
  requests: RequestService;
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
    };
  }
  return globalThis.pomiAppServices;
}

export const authService = () => appServices().auth;
export const payoutAddressService = () => appServices().payoutAddresses;
export const requestService = () => appServices().requests;
