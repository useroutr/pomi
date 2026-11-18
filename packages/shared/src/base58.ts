// Bitcoin's base58 alphabet, which Solana and Tron write addresses in: no 0,
// O, I or l, so none can be misread as another.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const VALUES = new Map(
  Array.from({ length: ALPHABET.length }, (_, index) => [ALPHABET.charAt(index), BigInt(index)]),
);

// The bytes a base58 string writes, or null when it holds a character outside
// the alphabet. Each leading "1" is a leading zero byte.
export function decodeBase58(text: string): Uint8Array | null {
  let value = 0n;
  for (const character of text) {
    const digit = VALUES.get(character);
    if (digit === undefined) {
      return null;
    }
    value = value * 58n + digit;
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }
  const leadingZeros = /^1*/.exec(text)?.[0].length ?? 0;
  return Uint8Array.from([...new Array<number>(leadingZeros).fill(0), ...bytes]);
}
