export const SIGN_IN_CODE_LENGTH = 6;

const GROUPED_CODE = /^\s*(\d{3})[\s-]?(\d{3})\s*$/;
// Six digits standing alone, so part of a longer number or an address never
// passes for a code.
const STANDALONE_CODE = /(?:^|[^0-9A-Za-z])(\d{6})(?![0-9A-Za-z])/g;

// Finds the sign-in code in whatever was copied: the code alone, the code in
// two groups ("305 040"), or a whole line of the email ("305040 is your Pomi
// sign-in code"). A text holding two different codes is ambiguous, so
// neither is taken.
export function findSignInCode(text: string): string | null {
  const grouped = GROUPED_CODE.exec(text);
  if (grouped !== null) {
    return `${grouped[1] ?? ""}${grouped[2] ?? ""}`;
  }
  const codes = new Set(Array.from(text.matchAll(STANDALONE_CODE), (match) => match[1]));
  const [code] = codes;
  return codes.size === 1 && code !== undefined ? code : null;
}
