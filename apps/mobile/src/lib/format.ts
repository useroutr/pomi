// Amounts arrive as Stellar decimal strings with up to seven places
// ("250.0000000"). They are shown trimmed and never turned into floats.
export function formatAmount(amount: string): string {
  const [whole = "0", fraction = ""] = amount.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return trimmed === "" ? grouped : `${grouped}.${trimmed}`;
}

const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const day = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dateTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// The full moment, for a receipt: "Thu 12 Nov, 06:15".
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 86_400_000;

// "Today, 9:14", "Yesterday, 18:40", "Mon", or "Mon 10 Nov": as near as
// the date is, as short as it can be.
export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (daysAgo === 0) {
    return `Today, ${time.format(date)}`;
  }
  if (daysAgo === 1) {
    return `Yesterday, ${time.format(date)}`;
  }
  if (daysAgo > 1 && daysAgo < 7) {
    return weekday.format(date);
  }
  return day.format(date);
}

export type Period = "Today" | "This week" | "Earlier";

export function periodOf(iso: string, now = new Date()): Period {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
  return daysAgo <= 0 ? "Today" : daysAgo < 7 ? "This week" : "Earlier";
}

// Decimal strings added without floating point, for "90 XLM in all".
export function sumAmounts(amounts: string[]): string {
  const SCALE = 7;
  const total = amounts.reduce((sum, amount) => {
    const [whole = "0", fraction = ""] = amount.split(".");
    return sum + BigInt(whole + fraction.padEnd(SCALE, "0").slice(0, SCALE));
  }, 0n);
  const digits = total.toString().padStart(SCALE + 1, "0");
  return formatAmount(`${digits.slice(0, -SCALE)}.${digits.slice(-SCALE)}`);
}
