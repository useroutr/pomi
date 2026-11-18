import { type TextStyle } from "react-native";

// Bricolage Grotesque is loaded once at launch (see the root layout). It is
// for names, titles and amounts; everything people read at length uses the
// system font, which follows Dynamic Type and the platform's own metrics.
export const DISPLAY_FONTS = {
  medium: "BricolageGrotesque_500Medium",
  semibold: "BricolageGrotesque_600SemiBold",
  bold: "BricolageGrotesque_700Bold",
} as const;

export type TextVariant =
  | "hero"
  | "amount"
  | "title"
  | "title2"
  | "section"
  | "figure"
  | "headline"
  | "body"
  | "callout"
  | "footnote"
  | "label"
  | "caption";

export const TEXT_VARIANTS: Record<TextVariant, TextStyle> = {
  hero: { fontFamily: DISPLAY_FONTS.semibold, fontSize: 64, lineHeight: 68, letterSpacing: -2 },
  amount: { fontFamily: DISPLAY_FONTS.semibold, fontSize: 48, lineHeight: 54, letterSpacing: -1.4 },
  title: { fontFamily: DISPLAY_FONTS.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title2: { fontFamily: DISPLAY_FONTS.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  section: {
    fontFamily: DISPLAY_FONTS.semibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  figure: { fontFamily: DISPLAY_FONTS.semibold, fontSize: 18, lineHeight: 22 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 24 },
  callout: { fontSize: 15, lineHeight: 21 },
  footnote: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 11, lineHeight: 13, fontWeight: "600" },
};
