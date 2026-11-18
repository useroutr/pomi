import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, type ViewStyle } from "react-native";
import { radius, usePalette } from "@/theme/theme";

// A soft placeholder in the shape of what is loading, shown at once instead
// of a spinner.
export function Skeleton({ style }: { style?: ViewStyle }) {
  const palette = usePalette();
  const [opacity] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) {
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[styles.block, { backgroundColor: palette.fill, opacity }, style]}
    />
  );
}

export function RowSkeleton() {
  return <Skeleton style={styles.row} />;
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.field },
  row: { height: 72, borderRadius: radius.row },
});
