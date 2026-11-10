import "server-only";
import { createAuthService, type AuthService } from "./auth/auth-service";
import { serverConfig } from "./config";
import { createDatabase, type Database } from "./database";
import { createEmailDelivery } from "./email/create-email-delivery";

interface AppServices {
  database: Database;
  auth: AuthService;
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
    globalThis.pomiAppServices = {
      database,
      auth: createAuthService({
        database,
        emailDelivery: createEmailDelivery(config.email),
        authSecret: config.authSecret,
      }),
    };
  }
  return globalThis.pomiAppServices;
}

export function authService(): AuthService {
  return appServices().auth;
}
