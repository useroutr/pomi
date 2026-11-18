export interface Tone {
  foreground: string;
  background: string;
}

export interface Palette {
  scheme: "light" | "dark";
  // The screen behind everything: warm paper, or deep ink at night.
  background: string;
  // Cards and rows that sit on the background.
  surface: string;
  // Fields, keys and quiet buttons.
  fill: string;
  fillPressed: string;
  line: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  // The one prominent button on a screen.
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  coral: string;
  danger: string;
  focus: string;
  paid: Tone;
  waiting: Tone;
  closed: Tone;
  reusable: Tone;
  notice: Tone;
}

// Every text color here meets 4.5:1 on the background and surface it sits on.
// Vibrant the way shipped money apps are: white cards on a cool light ground,
// one violet action per screen, and the brand gradient kept for the moments
// that matter (your page, asking, being paid).
export const light: Palette = {
  scheme: "light",
  background: "#F6F4F9",
  surface: "#FFFFFF",
  fill: "#EFECF4",
  fillPressed: "#E4E0EC",
  line: "#E7E2EE",
  text: "#15121C",
  textSecondary: "#5F5A6B",
  textTertiary: "#6A6476",
  primary: "#6A3DF5",
  primaryPressed: "#5A2EE0",
  onPrimary: "#FFFFFF",
  coral: "#F2541B",
  danger: "#B42318",
  focus: "#6A3DF5",
  paid: { foreground: "#11774A", background: "#E2F6EA" },
  waiting: { foreground: "#9A4F00", background: "#FFF0DC" },
  closed: { foreground: "#5F5A6B", background: "#EFECF4" },
  reusable: { foreground: "#5B34E0", background: "#EEE8FF" },
  notice: { foreground: "#7A4600", background: "#FFF0DC" },
};

export const dark: Palette = {
  scheme: "dark",
  background: "#0E0C14",
  surface: "#1A1722",
  fill: "#25212F",
  fillPressed: "#302B3C",
  line: "#2E2939",
  text: "#F7F5FB",
  textSecondary: "#B9B3C6",
  textTertiary: "#A29BB0",
  primary: "#A48BFF",
  primaryPressed: "#8F73FF",
  onPrimary: "#0E0C14",
  coral: "#FF7A4D",
  danger: "#FF8A80",
  focus: "#B9A3FF",
  paid: { foreground: "#7FD9A3", background: "#11301F" },
  waiting: { foreground: "#FFC46B", background: "#33250A" },
  closed: { foreground: "#B9B3C6", background: "#25212F" },
  reusable: { foreground: "#BFAEFF", background: "#2A2350" },
  notice: { foreground: "#FFD27A", background: "#33250A" },
};

// The violet the brand gradient starts from, for text on white over it.
export const BRAND_VIOLET = "#6A3DF5";

// The brand surface: violet into pink into orange. White text sits on its
// violet end (5.4:1); the orange end carries only large type and white
// buttons, which is where layouts put them.
export const BRAND_GRADIENT =
  "linear-gradient(150deg, #6A3DF5 0%, #C42A9E 45%, #E8306F 70%, #F2621F 100%)";

// The same colors for a whole screen, top to bottom.
export const BRAND_SCREEN_GRADIENT =
  "linear-gradient(180deg, #6A3DF5 0%, #B12FA8 38%, #E52E6E 72%, #F2621F 100%)";

// The vibrant card: the brand colors as soft pools of light on a deep violet,
// as if seen through frosted glass, with film grain laid over them
// (components/vibrant-surface.tsx). White text sits top left, where the light
// violet still gives it 4.6:1; the warm pools sit right and bottom right,
// behind white controls.
export const VIBRANT_BASE = "#5A2FE6";
export const VIBRANT_MESH = [
  "radial-gradient(circle at 10% 6%, rgba(122, 82, 255, 0.95) 0%, rgba(122, 82, 255, 0) 52%)",
  "radial-gradient(circle at 92% 14%, rgba(255, 79, 163, 0.9) 0%, rgba(255, 79, 163, 0) 50%)",
  "radial-gradient(circle at 100% 100%, rgba(255, 140, 66, 0.95) 0%, rgba(255, 140, 66, 0) 58%)",
  "radial-gradient(circle at 0% 100%, rgba(38, 19, 120, 0.95) 0%, rgba(38, 19, 120, 0) 60%)",
].join(", ");

// The orb, Pomi's mark. Its colors never change with the theme.
export const ORB_GRADIENT =
  "radial-gradient(circle at 34% 30%, #FFE3D1 0%, #FF9E70 34%, #F0613A 62%, #7C6CF0 100%)";

// The cards a QR code is shared on, as Linktree's are: one light color with
// the code, the name and the link in one deep ink on it. Each ink meets 7:1 on
// its card, enough for any scanner and for text. A code stays dark on light in
// either theme, as printed codes are.
export interface QrColorway {
  name: string;
  card: string;
  ink: string;
}

export const QR_COLORWAYS = [
  { name: "Lavender", card: "#E6DCFF", ink: "#26136B" },
  { name: "Peach", card: "#FFD8C2", ink: "#5B1D07" },
  { name: "Blush", card: "#FFD3E8", ink: "#5E0B3B" },
  { name: "Paper", card: "#FFFFFF", ink: "#15121C" },
] as const satisfies readonly QrColorway[];
