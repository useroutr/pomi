import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { haptics } from "@/lib/haptics";
import { usePalette } from "@/theme/theme";
import { Icon } from "./icon";
import { Text } from "./text";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"] as const;
type Key = (typeof KEYS)[number];

// Stellar amounts carry at most seven decimal places, the most any asset
// Pomi offers has; a request needs no more than 12 digits before the point.
const MAX_DECIMALS = 7;
const MAX_WHOLE_DIGITS = 12;

export function pressKey(amount: string, key: Key, maxDecimals = MAX_DECIMALS): string {
  if (key === "delete") {
    return amount.length <= 1 ? "0" : amount.slice(0, -1);
  }
  if (key === ".") {
    return amount.includes(".") || maxDecimals === 0 ? amount : `${amount}.`;
  }
  const [whole = "", fraction] = amount.split(".");
  if (fraction !== undefined) {
    return fraction.length >= Math.min(maxDecimals, MAX_DECIMALS) ? amount : amount + key;
  }
  if (whole === "0") {
    return key;
  }
  return whole.length >= MAX_WHOLE_DIGITS ? amount : amount + key;
}

export function Keypad({
  value,
  onChange,
  onRefuse,
  maxDecimals = MAX_DECIMALS,
  light = false,
}: {
  // Read once, when the keypad appears: from then on the keypad is the only
  // thing that changes the amount.
  value: string;
  onChange: (value: string) => void;
  // A key that would make the amount invalid, such as an eighth decimal.
  onRefuse: () => void;
  // The asset's decimal places: USDC on Base has six, Stellar assets seven.
  maxDecimals?: number | undefined;
  // White keys, for a keypad on the brand colors.
  light?: boolean;
}) {
  // Keys can land faster than the screen re-renders. Each one builds on the
  // amount the previous key made, not on the last rendered value, or a quick
  // "1 2 3 4" would lose digits.
  const latest = useRef(value);

  function press(key: Key) {
    const next = pressKey(latest.current, key, maxDecimals);
    if (next === latest.current) {
      haptics.warning();
      onRefuse();
      return;
    }
    haptics.select();
    latest.current = next;
    onChange(next);
  }

  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <KeypadKey key={key} keyName={key} light={light} onPress={press} />
      ))}
    </View>
  );
}

// A key counts the moment a finger lands, like the system keypads, and
// listens to raw touches rather than React Native's press handling, which
// lets only one touch at a time own the screen: with it, a key pressed while
// the other thumb is still lifting from the last one would be lost.
function KeypadKey({
  keyName,
  light,
  onPress,
}: {
  keyName: Key;
  light: boolean;
  onPress: (key: Key) => void;
}) {
  const palette = usePalette();
  const ink = light ? "#FFFFFF" : palette.text;
  const pressed = useRef(new Animated.Value(0)).current;

  function settle(toValue: number) {
    Animated.spring(pressed, {
      toValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: toValue === 0 ? 6 : 0,
    }).start();
  }

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        keyName === "delete" ? "Delete" : keyName === "." ? "Decimal point" : keyName
      }
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") {
          onPress(keyName);
        }
      }}
      onTouchStart={() => {
        settle(1);
        onPress(keyName);
      }}
      onTouchEnd={() => {
        settle(0);
      }}
      onTouchCancel={() => {
        settle(0);
      }}
      style={styles.key}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: light ? "rgba(255, 255, 255, 0.22)" : palette.fill,
            opacity: pressed,
            transform: [
              { scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          transform: [
            { scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) },
          ],
        }}
      >
        {keyName === "delete" ? (
          <Icon name="backspace" size={24} color={ink} weight="regular" />
        ) : (
          <Text variant="title" style={[styles.digit, { color: ink }]}>
            {keyName}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  key: {
    width: "33.333%",
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: { position: "absolute", width: 64, height: 56, borderRadius: 28 },
  digit: { fontSize: 30, lineHeight: 36 },
});
