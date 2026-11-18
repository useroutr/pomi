// Amounts arrive as decimal strings with up to seven places ("250.0000000").
// They are shown trimmed and grouped, and never turned into floats.
export function formatAmount(amount: string): string {
  const [whole = "0", fraction = ""] = amount.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return trimmed === "" ? grouped : `${grouped}.${trimmed}`;
}

// Decimal strings added without floating point, for "90 XLM in all". Seven
// places is the most any asset Pomi handles carries (Stellar's stroops).
export function sumAmounts(amounts: string[]): string {
  const SCALE = 7;
  const total = amounts.reduce((sum, amount) => {
    const [whole = "0", fraction = ""] = amount.split(".");
    return sum + BigInt(whole + fraction.padEnd(SCALE, "0").slice(0, SCALE));
  }, 0n);
  const digits = total.toString().padStart(SCALE + 1, "0");
  return formatAmount(`${digits.slice(0, -SCALE)}.${digits.slice(-SCALE)}`);
}
