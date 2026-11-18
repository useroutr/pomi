import { useColorScheme } from "react-native";
import { dark, light, type Palette } from "./palette";

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radius = { field: 16, row: 20, card: 24, sheet: 28, pill: 999 } as const;

// The screen margin used everywhere, so edges line up from screen to screen.
export const GUTTER = 20;

// The lift under a white card: a hairline of shadow and a soft spread, as
// banking apps raise their main cards off the page.
export const CARD_SHADOW =
  "0 1px 2px rgba(21, 18, 28, 0.04), 0 8px 24px -12px rgba(21, 18, 28, 0.12)";
