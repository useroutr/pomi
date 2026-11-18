import qrcode from "qrcode-generator";

const FINDER = 7;
// How far a module is drawn inside its cell, and how round its corners are,
// in module units: small gaps and soft corners, still read as squares.
const INSET = 0.06;
const CORNER = 0.3;

export interface QrPaths {
  // The data modules, with the finder eyes and the cleared centre left out.
  modules: string;
  // The three finder eyes, to fill with the even-odd rule.
  finders: string;
  count: number;
  // How many modules wide the cleared centre is.
  clear: number;
}

// SVG paths for a QR code in module units, the way Pomi draws one.
export function drawQrCode(value: string): QrPaths {
  const code = qrcode(0, "H");
  code.addData(value);
  code.make();
  const count = code.getModuleCount();
  // An odd number of modules about a quarter of the code wide, so the
  // cleared square sits exactly in the middle.
  const clear = Math.round(count * 0.13) * 2 + 1;
  const clearStart = (count - clear) / 2;
  const inClear = (index: number) => index >= clearStart && index < clearStart + clear;

  let modules = "";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (inFinder(row, column, count) || (inClear(row) && inClear(column))) {
        continue;
      }
      if (code.isDark(row, column)) {
        modules += roundedSquare(column + INSET, row + INSET, 1 - INSET * 2, CORNER);
      }
    }
  }

  let finders = "";
  for (const [row, column] of [
    [0, 0],
    [0, count - FINDER],
    [count - FINDER, 0],
  ] as const) {
    finders += roundedSquare(column, row, 7, 2.2);
    finders += roundedSquare(column + 1, row + 1, 5, 1.4);
    finders += roundedSquare(column + 2, row + 2, 3, 0.9);
  }
  return { modules, finders, count, clear };
}

function inFinder(row: number, column: number, count: number): boolean {
  const top = row < FINDER;
  const left = column < FINDER;
  return (top && left) || (top && column >= count - FINDER) || (left && row >= count - FINDER);
}

export function roundedSquare(x: number, y: number, side: number, corner: number): string {
  const straight = side - corner * 2;
  const arc = (dx: number, dy: number) =>
    `a${String(corner)} ${String(corner)} 0 0 1 ${String(dx)} ${String(dy)}`;
  return (
    `M${String(x + corner)} ${String(y)}h${String(straight)}${arc(corner, corner)}` +
    `v${String(straight)}${arc(-corner, corner)}h${String(-straight)}${arc(-corner, -corner)}` +
    `v${String(-straight)}${arc(corner, -corner)}z`
  );
}
