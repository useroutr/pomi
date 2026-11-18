import { type ReactNode, useState } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// The Pressable itself is animated, so its style (flex, width) lays it out
// in its row and the whole control scales, background and all.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Every custom control shrinks a little under the finger and springs back:
// the press state Apple asks for, felt rather than only seen.
export function PressableScale({
  style,
  pressedScale = 0.97,
  children,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  children: ReactNode;
}) {
  const [scale] = useState(() => new Animated.Value(1));

  function springTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: value === 1 ? 6 : 0,
    }).start();
  }

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        springTo(pressedScale);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        springTo(1);
        props.onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
