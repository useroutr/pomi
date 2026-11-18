import "server-only";
import { InvalidHandleError, parseHandle } from "@pomi/shared";
import { Prisma } from "@/generated/prisma/client";
import { type Database } from "../database";
import {
  HandleAlreadyClaimedError,
  HandleTakenError,
  InvalidDisplayNameError,
} from "./profile-errors";

const DISPLAY_NAME_MAX_LENGTH = 50;

export interface Profile {
  handle: string | null;
  displayName: string | null;
}

export type ProfileService = ReturnType<typeof createProfileService>;

export function createProfileService({ database }: { database: Database }) {
  async function profile(userId: string): Promise<Profile> {
    return database.user.findUniqueOrThrow({
      where: { id: userId },
      select: { handle: true, displayName: true },
    });
  }

  async function claimHandle(userId: string, input: string): Promise<Profile> {
    const handle = parseHandle(input);
    try {
      // The condition is in the update, so two claims at once cannot both
      // set a handle for the same receiver.
      const { count } = await database.user.updateMany({
        where: { id: userId, handle: null },
        data: { handle },
      });
      if (count === 0) {
        throw new HandleAlreadyClaimedError();
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HandleTakenError();
      }
      throw error;
    }
    return profile(userId);
  }

  async function setDisplayName(userId: string, input: string): Promise<Profile> {
    const displayName = input.trim().replace(/\s+/g, " ");
    if (displayName.length === 0 || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new InvalidDisplayNameError();
    }
    await database.user.update({ where: { id: userId }, data: { displayName } });
    return profile(userId);
  }

  // Lets the app say "free" or "taken" while the receiver types. The claim
  // itself still decides, under the unique constraint.
  async function handleAvailability(input: string): Promise<HandleAvailability> {
    let handle: string;
    try {
      handle = parseHandle(input);
    } catch (error) {
      if (error instanceof InvalidHandleError) {
        return { handle: input.trim().toLowerCase(), available: false, problem: error.message };
      }
      throw error;
    }
    const owner = await database.user.findUnique({ where: { handle }, select: { id: true } });
    return owner === null
      ? { handle, available: true, problem: null }
      : { handle, available: false, problem: new HandleTakenError().message };
  }

  return { profile, claimHandle, setDisplayName, handleAvailability };
}

export interface HandleAvailability {
  handle: string;
  available: boolean;
  problem: string | null;
}
