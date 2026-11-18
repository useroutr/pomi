import { type ReactNode } from "react";
import { Image, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import grain from "../../assets/textures/grain.png";
import { VIBRANT_BASE, VIBRANT_MESH } from "@/theme/palette";

// The brand colors as blurred light with a fine grain over them, for the one
// card on a screen that should feel like Pomi. The grain is a tile drawn at
// each screen density (scripts/render-textures.py), so it stays one pixel
// fine at any card size. The shadow sits on an outer layer, since the inner
// one clips the grain to the corners; the padding sits on the content, so the
// grain can fill the unpadded layer.
export function VibrantSurface({
  radius,
  style,
  children,
}: {
  radius: number;
  // Padding and layout for what sits on the card.
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View style={[styles.lift, { borderRadius: radius }]}>
      <View style={[styles.surface, { borderRadius: radius }]}>
        <Image
          source={grain}
          resizeMode="repeat"
          accessible={false}
          pointerEvents="none"
          style={styles.grain}
        />
        <View style={style}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lift: { boxShadow: "0 22px 40px -22px rgba(90, 47, 230, 0.75)" },
  surface: {
    overflow: "hidden",
    backgroundColor: VIBRANT_BASE,
    backgroundImage: VIBRANT_MESH,
    // A hairline of light on the edge, as on frosted glass.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  // A size is needed, or the image keeps its own tile size.
  grain: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.55 },
});
