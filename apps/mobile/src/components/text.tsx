import { Text as NativeText, type TextProps } from "react-native";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";
import { TEXT_VARIANTS, type TextVariant } from "@/theme/type";

export type TextTone =
  "primary" | "secondary" | "tertiary" | "onPrimary" | "paid" | "waiting" | "reusable" | "danger";

function toneColor(palette: Palette, tone: TextTone): string {
  switch (tone) {
    case "primary":
      return palette.text;
    case "secondary":
      return palette.textSecondary;
    case "tertiary":
      return palette.textTertiary;
    case "onPrimary":
      return palette.onPrimary;
    case "paid":
      return palette.paid.foreground;
    case "waiting":
      return palette.waiting.foreground;
    case "reusable":
      return palette.reusable.foreground;
    case "danger":
      return palette.danger;
  }
}

// Display sizes grow with Dynamic Type only so far: a 64-point amount at the
// largest accessibility size would not fit on a phone.
const MAX_SCALE: Partial<Record<TextVariant, number>> = { hero: 1.2, amount: 1.3, title: 1.4 };

export function Text({
  variant = "body",
  tone = "primary",
  style,
  ...props
}: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  const palette = usePalette();
  return (
    <NativeText
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...props}
      style={[TEXT_VARIANTS[variant], { color: toneColor(palette, tone) }, style]}
    />
  );
}
