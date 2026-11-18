import { StyleSheet, View } from "react-native";
import { haptics } from "@/lib/haptics";
import { radius, usePalette } from "@/theme/theme";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  stretch?: boolean;
}) {
  const palette = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: palette.fill }, stretch && styles.stretch]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            pressedScale={0.95}
            onPress={() => {
              if (!selected) {
                haptics.select();
                onChange(option.value);
              }
            }}
            style={[
              styles.segment,
              stretch && styles.segmentStretch,
              selected && [
                styles.selected,
                {
                  backgroundColor:
                    palette.scheme === "dark" ? palette.fillPressed : palette.surface,
                },
              ],
            ]}
          >
            <Text
              variant="label"
              tone={selected ? "primary" : "secondary"}
              numberOfLines={1}
              style={styles.text}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, borderRadius: radius.pill, alignSelf: "center" },
  stretch: { alignSelf: "stretch" },
  segment: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentStretch: { flex: 1, paddingHorizontal: 6 },
  selected: { boxShadow: "0 1px 4px rgba(26, 22, 32, 0.14)" },
  text: { fontSize: 15 },
});
