import { ScrollView, StyleSheet } from "react-native";
import { haptics } from "@/lib/haptics";
import { GUTTER, radius, usePalette } from "@/theme/theme";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

// One choice among a few filters, as chips that scroll sideways if the text
// is large, each with how many items it would show.
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; count: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const palette = usePalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      contentContainerStyle={styles.row}
      style={styles.strip}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label}, ${String(option.count)}`}
            onPress={() => {
              if (!selected) {
                haptics.select();
                onChange(option.value);
              }
            }}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: palette.primary, borderColor: palette.primary }
                : { backgroundColor: palette.surface, borderColor: palette.line },
            ]}
          >
            <Text
              variant="headline"
              style={[styles.text, { color: selected ? palette.onPrimary : palette.text }]}
            >
              {option.label}
            </Text>
            <Text
              variant="label"
              style={{ color: selected ? palette.onPrimary : palette.textSecondary }}
            >
              {String(option.count)}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Runs edge to edge, so chips scroll under the screen's margins.
  strip: { flexGrow: 0, marginHorizontal: -GUTTER },
  row: { gap: 8, paddingHorizontal: GUTTER },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 15 },
});
