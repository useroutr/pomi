import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { BRAND_VIOLET } from "@/theme/palette";
import { DISPLAY_FONTS } from "@/theme/type";
import { Text } from "./text";

// Pomi's mark: a bold p whose bowl is a coin, a ring around a dot, with the
// stem cut from the bowl by a gap that follows the ring. One flat color, so it
// reads at any size and sits in the middle of a QR code. Drawn on a 100-unit
// square; scripts/render-icons.py draws the same shapes for the app icon.
export const MARK = {
  ring: "M50 5a32 32 0 1 1 0 64a32 32 0 1 1 0-64zM50 22a15 15 0 1 0 0 30a15 15 0 1 0 0-30z",
  stem: "M18 55.57A37 37 0 0 0 35 70.82V95H18z",
  dot: { cx: 50, cy: 37, r: 7 },
} as const;

export function PomiMark({
  size,
  color,
  dotColor = color,
}: {
  size: number;
  color: string;
  // The coin can take an accent of its own, as it does on the app icon.
  dotColor?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
      <Path d={MARK.ring} fill={color} fillRule="evenodd" />
      <Path d={MARK.stem} fill={color} />
      <Circle cx={MARK.dot.cx} cy={MARK.dot.cy} r={MARK.dot.r} fill={dotColor} />
    </Svg>
  );
}

// The app icon's face: the white mark on the brand violet, its coin in the
// coral of the old orb. Where the app stands for itself, as at launch.
export const ICON_COIN = "#FF8A5B";

export function PomiTile({ size }: { size: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Pomi"
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.27 }]}
    >
      <PomiMark size={size * 0.62} color="#FFFFFF" dotColor={ICON_COIN} />
    </View>
  );
}

// The mark beside the name, set lowercase as the mark's own letter is.
export function PomiLogo({ height, color }: { height: number; color: string }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Pomi"
      // The mark's own side bearing already spaces it from the word.
      style={[styles.lockup, { gap: height * 0.02 }]}
    >
      <PomiMark size={height} color={color} />
      <Text
        style={{
          color,
          fontFamily: DISPLAY_FONTS.bold,
          fontSize: height * 0.92,
          lineHeight: height * 1.05,
          letterSpacing: -height * 0.04,
        }}
      >
        pomi
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: "row", alignItems: "center" },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_VIOLET,
    boxShadow: "0 16px 32px -14px rgba(106, 61, 245, 0.6)",
  },
});
