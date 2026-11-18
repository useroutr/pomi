import { POMI_ICON_COIN, POMI_MARK } from "@pomi/shared";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { BRAND_VIOLET } from "@/theme/palette";
import { DISPLAY_FONTS } from "@/theme/type";
import { Text } from "./text";

// Pomi's mark (POMI_MARK in @pomi/shared): one flat color, so it reads at any
// size and sits in the middle of a QR code.
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
      <Path d={POMI_MARK.ring} fill={color} fillRule="evenodd" />
      <Path d={POMI_MARK.stem} fill={color} />
      <Circle cx={POMI_MARK.dot.cx} cy={POMI_MARK.dot.cy} r={POMI_MARK.dot.r} fill={dotColor} />
    </Svg>
  );
}

export function PomiTile({ size }: { size: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Pomi"
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.27 }]}
    >
      <PomiMark size={size * 0.62} color="#FFFFFF" dotColor={POMI_ICON_COIN} />
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
