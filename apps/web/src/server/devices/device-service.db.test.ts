import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { emptyTables, testDatabase } from "@/test/test-database";
import { createDeviceService, InvalidPushTokenError } from "./device-service";

const database = testDatabase();
const devices = createDeviceService({ database });
const TOKEN = "ExponentPushToken[abc123]";

beforeEach(async () => {
  await emptyTables(database);
  await database.user.create({ data: { id: "usr_1", email: "ada@example.com" } });
  await database.user.create({ data: { id: "usr_2", email: "ben@example.com" } });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("devices", () => {
  it("registers a device once, however often the app reports it", async () => {
    await devices.registerDevice("usr_1", { pushToken: TOKEN, platform: "IOS" });
    await devices.registerDevice("usr_1", { pushToken: TOKEN, platform: "IOS" });

    expect(await database.device.count()).toBe(1);
  });

  it("moves a device to whoever signed in on it last", async () => {
    await devices.registerDevice("usr_1", { pushToken: TOKEN, platform: "IOS" });

    await devices.registerDevice("usr_2", { pushToken: TOKEN, platform: "IOS" });

    await expect(database.device.findFirstOrThrow()).resolves.toMatchObject({ userId: "usr_2" });
  });

  it("forgets a device only for its own receiver", async () => {
    await devices.registerDevice("usr_1", { pushToken: TOKEN, platform: "ANDROID" });

    await devices.forgetDevice("usr_2", TOKEN);
    expect(await database.device.count()).toBe(1);
    await devices.forgetDevice("usr_1", TOKEN);
    expect(await database.device.count()).toBe(0);
  });

  it.each(["abc", "ExponentPushToken[]", "https://example.com"])(
    "refuses the push token %j",
    async (pushToken) => {
      await expect(devices.registerDevice("usr_1", { pushToken, platform: "IOS" })).rejects.toThrow(
        InvalidPushTokenError,
      );
    },
  );
});
