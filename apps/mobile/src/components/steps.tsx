import { StyleSheet, View } from "react-native";
import { usePalette } from "@/theme/theme";

// Onboarding progress: which of the four steps this is.
export function Steps({ current, total = 4 }: { current: number; total?: number }) {
  const palette = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`Step ${String(current)} of ${String(total)}`}
      style={styles.row}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.bar, { backgroundColor: index < current ? palette.text : palette.line }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});
