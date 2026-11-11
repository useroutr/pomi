import "server-only";
import { type Database } from "../database";
import { newId } from "../ids";

// The form Expo gives push tokens.
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[\w-]+\]$/;

export class InvalidPushTokenError extends Error {
  constructor() {
    super("That is not an Expo push token.");
    this.name = "InvalidPushTokenError";
  }
}

export type DeviceService = ReturnType<typeof createDeviceService>;

export function createDeviceService({
  database,
  now = () => new Date(),
}: {
  database: Database;
  now?: () => Date;
}) {
  // A device belongs to whoever signed in on it last, so a phone passed to
  // someone else stops receiving the first person's payments.
  async function registerDevice(
    userId: string,
    device: { pushToken: string; platform: "IOS" | "ANDROID" },
  ): Promise<void> {
    if (!EXPO_PUSH_TOKEN.test(device.pushToken)) {
      throw new InvalidPushTokenError();
    }
    await database.device.upsert({
      where: { pushToken: device.pushToken },
      create: { id: newId("dev"), userId, ...device, createdAt: now() },
      update: { userId, platform: device.platform },
    });
  }

  async function forgetDevice(userId: string, pushToken: string): Promise<void> {
    await database.device.deleteMany({ where: { userId, pushToken } });
  }

  return { registerDevice, forgetDevice };
}
