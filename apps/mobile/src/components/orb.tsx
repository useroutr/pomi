import { type ReactNode, useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { ORB_GRADIENT } from "@/theme/palette";

// Pomi's mark: a glowing orb. It breathes slowly where it greets people.
// Reduce Motion keeps it still.
export function Orb({
  size,
  glow = true,
  breathe = false,
  children,
}: {
  size: number;
  glow?: boolean;
  breathe?: boolean;
  children?: ReactNode;
}) {
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!breathe) {
      return;
    }
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) {
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.045,
            duration: 2200,
            easing: Easing.inOut((value) => Easing.sin(value)),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut((value) => Easing.sin(value)),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [breathe, scale]);

  return (
    <Animated.View
      accessible={false}
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: glow
            ? `0 ${String(Math.round(size * 0.14))}px ${String(Math.round(size * 0.48))}px rgba(240, 97, 58, 0.45), 0 0 ${String(Math.round(size * 0.7))}px rgba(124, 108, 240, 0.28)`
            : undefined,
          transform: [{ scale }],
        },
      ]}
    >
      <View
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundImage: ORB_GRADIENT }]}
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: { alignItems: "center", justifyContent: "center" },
});
