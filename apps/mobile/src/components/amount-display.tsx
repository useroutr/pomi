import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { useReduceMotion } from "@/lib/reduce-motion";
import { Text } from "./text";

// The large figure over the keypad. It shrinks smoothly to fit as digits are
// added, gives a small bump with each key, and shakes when a key is refused
// (an eighth decimal, a second point, deleting past zero).
export function AmountDisplay({
  amount,
  symbol,
  refusals,
  color,
}: {
  amount: string;
  symbol: string;
  // White on the brand colors; the theme's text otherwise.
  color?: string;
  // Counts refused keys; each new value shakes the figure once.
  refusals: number;
}) {
  const reduceMotion = useReduceMotion();
  const shake = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const shown = useRef(amount);

  useEffect(() => {
    if (shown.current === amount) {
      return;
    }
    shown.current = amount;
    if (reduceMotion) {
      return;
    }
    bump.setValue(1.05);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }, [amount, bump, reduceMotion]);

  useEffect(() => {
    if (refusals === 0 || reduceMotion) {
      return;
    }
    Animated.sequence(
      [-12, 12, -8, 8, -4, 0].map((offset) =>
        Animated.timing(shake, { toValue: offset, duration: 45, useNativeDriver: true }),
      ),
    ).start();
  }, [refusals, shake, reduceMotion]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${amount} ${symbol}`}
      style={[styles.row, { transform: [{ translateX: shake }, { scale: bump }] }]}
    >
      <Text
        variant="hero"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.4}
        style={[styles.figure, color !== undefined && { color }]}
      >
        {amount}
      </Text>
      <Text
        variant="title"
        tone="secondary"
        style={color !== undefined && { color, opacity: 0.85 }}
      >
        {symbol}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 10,
    maxWidth: "100%",
    height: 100,
  },
  figure: { fontSize: 88, lineHeight: 96, flexShrink: 1 },
});
