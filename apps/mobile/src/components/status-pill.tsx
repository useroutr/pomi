import { StyleSheet, View } from "react-native";
import { type Palette, type Tone } from "@/theme/palette";
import { radius, usePalette } from "@/theme/theme";
import { Text } from "./text";

export type PillKind = "paid" | "waiting" | "closed" | "reusable" | "listed";

function toneOf(palette: Palette, kind: PillKind): Tone {
  switch (kind) {
    case "paid":
      return palette.paid;
    case "waiting":
      return palette.waiting;
    case "reusable":
      return palette.reusable;
    case "closed":
    case "listed":
      return palette.closed;
  }
}

// A word and a dot, never color alone.
export function StatusPill({ kind, label }: { kind: PillKind; label: string }) {
  const palette = usePalette();
  const tone = toneOf(palette, kind);
  const dotted = kind === "paid" || kind === "waiting" || kind === "closed";
  return (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      {dotted && <View style={[styles.dot, { backgroundColor: tone.foreground }]} />}
      <Text variant="label" style={{ color: tone.foreground }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
