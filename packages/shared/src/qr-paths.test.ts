import { describe, expect, it } from "vitest";
import { drawQrCode, roundedSquare } from "./qr-paths";

// The longest links Pomi shares: a request link and a 30-character handle.
const LONG_LINKS = [
  "https://pomi.useroutr.com/r/req_Az2yQvoKVuuy9P7rDjhCYw",
  "https://pomi.app/abcdefghijklmnopqrstuvwxyz1234",
];

describe("drawQrCode", () => {
  it.each(LONG_LINKS)(
    "keeps %j at version 6 or below, with no alignment pattern in the centre",
    (link) => {
      // Version 6 is 41 modules; version 7 adds a centre alignment pattern
      // that the cleared middle would cover.
      expect(drawQrCode(link).count).toBeLessThanOrEqual(41);
    },
  );

  it("clears an odd, centred square about a quarter of the code wide", () => {
    const code = drawQrCode("https://pomi.useroutr.com/ada");

    expect(code.clear % 2).toBe(1);
    expect((code.count - code.clear) % 2).toBe(0);
    expect(code.clear / code.count).toBeGreaterThan(0.2);
    expect(code.clear / code.count).toBeLessThan(0.3);
  });

  it("draws three finder eyes, each a ring around a centre", () => {
    // Three rounded squares per eye: outer, hole, centre.
    expect(drawQrCode("https://pomi.useroutr.com/ada").finders.match(/M/g)).toHaveLength(9);
  });

  it("draws the same code for the same link", () => {
    expect(drawQrCode("https://pomi.useroutr.com/ada")).toEqual(
      drawQrCode("https://pomi.useroutr.com/ada"),
    );
  });
});

describe("roundedSquare", () => {
  it("starts after the corner and closes the path", () => {
    expect(roundedSquare(0, 0, 7, 2)).toMatch(/^M2 0h3a2 2 0 0 1 2 2/);
    expect(roundedSquare(0, 0, 7, 2).endsWith("z")).toBe(true);
  });
});
