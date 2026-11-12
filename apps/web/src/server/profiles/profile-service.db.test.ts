import { InvalidHandleError } from "@pomi/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { emptyTables, testDatabase } from "@/test/test-database";
import {
  HandleAlreadyClaimedError,
  HandleTakenError,
  InvalidDisplayNameError,
} from "./profile-errors";
import { createProfileService } from "./profile-service";

const database = testDatabase();
const profiles = createProfileService({ database });

beforeEach(async () => {
  await emptyTables(database);
  await database.user.create({ data: { id: "usr_1", email: "ada@example.com" } });
  await database.user.create({ data: { id: "usr_2", email: "ben@example.com" } });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("handles", () => {
  it("claims a handle, lowercased", async () => {
    await expect(profiles.claimHandle("usr_1", " Ada-L ")).resolves.toEqual({
      handle: "ada-l",
      displayName: null,
    });
  });

  it("claims a handle once: links already shared keep working", async () => {
    await profiles.claimHandle("usr_1", "ada");

    await expect(profiles.claimHandle("usr_1", "ada2")).rejects.toThrow(HandleAlreadyClaimedError);
  });

  it("refuses a handle someone else holds", async () => {
    await profiles.claimHandle("usr_1", "ada");

    await expect(profiles.claimHandle("usr_2", "ADA")).rejects.toThrow(HandleTakenError);
  });

  it.each(["dashboard", "pomi", "a", "ab--c"])("refuses %j", async (handle) => {
    await expect(profiles.claimHandle("usr_1", handle)).rejects.toThrow(InvalidHandleError);
  });

  it("gives one of two receivers a handle when both claim it at once", async () => {
    const results = await Promise.allSettled([
      profiles.claimHandle("usr_1", "ada"),
      profiles.claimHandle("usr_2", "ada"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.user.count({ where: { handle: "ada" } })).toBe(1);
  });
});

describe("display names", () => {
  it("sets and changes a display name, tidying its spaces", async () => {
    await profiles.setDisplayName("usr_1", "  Ada   Lovelace ");

    await expect(profiles.profile("usr_1")).resolves.toEqual({
      handle: null,
      displayName: "Ada Lovelace",
    });
  });

  it.each(["", "   ", "x".repeat(51)])("refuses %j", async (name) => {
    await expect(profiles.setDisplayName("usr_1", name)).rejects.toThrow(InvalidDisplayNameError);
  });
});
