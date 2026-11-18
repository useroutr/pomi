import { StyleSheet, View } from "react-native";
import { usePalette } from "@/theme/theme";
import { Icon, type IconName } from "./icon";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

// A round, labelled action, as banking apps put Add, Move and Send under a
// balance.
export function RoundAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedScale={0.92}
      onPress={onPress}
      style={styles.action}
    >
      <View style={[styles.circle, { backgroundColor: palette.fill }]}>
        <Icon name={icon} size={20} color={palette.text} />
      </View>
      <Text variant="footnote" tone="secondary" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: "center", gap: 6, width: 68 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontWeight: "600" },
});
