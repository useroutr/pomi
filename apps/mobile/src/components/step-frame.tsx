import { type ReactNode, useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";

// Slides a step in from the side it comes from: forward from the right,
// back from the left. Reduce Motion makes it a plain cut.
export function StepFrame({ direction, children }: { direction: 1 | -1; children: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      Animated.timing(progress, {
        toValue: 1,
        duration: reduced ? 0 : 280,
        easing: Easing.out((value) => Easing.cubic(value)),
        useNativeDriver: true,
      }).start();
    });
  }, [progress]);

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [28 * direction, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
