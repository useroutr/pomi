import { z } from "zod";
import { InvalidEmailAddressError } from "./auth-errors";

// Addresses are compared and stored lowercase, so one inbox holds one account
// however it is typed.
const emailAddressSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export function parseEmailAddress(input: string): string {
  const result = emailAddressSchema.safeParse(input);
  if (!result.success) {
    throw new InvalidEmailAddressError();
  }
  return result.data;
}
