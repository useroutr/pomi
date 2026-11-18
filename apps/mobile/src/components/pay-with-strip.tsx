import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { type PaymentNetwork } from "@/lib/api";
import { networkList } from "@/lib/networks";
import { radius, usePalette } from "@/theme/theme";
import { NetworkStack } from "./asset-logo";
import { Icon } from "./icon";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

// At most this many logos in the stack; the sentence names them all.
const STACK_SIZE = 4;

// Where payers can pay from, as Useroutr lists it today. Opens the full list
// of networks and the tokens each takes.
export function PayWithStrip({ payWith }: { payWith: PaymentNetwork[] }) {
  const palette = usePalette();
  const networks = payWith.map((entry) => entry.network);
  if (networks.length === 0) {
    return null;
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Payers can pay from ${networkList(networks)}`}
      accessibilityHint="Shows every network and token payers can use"
      onPress={() => {
        router.push("/pay-with");
      }}
      style={[styles.strip, { backgroundColor: palette.surface, borderColor: palette.line }]}
    >
      <NetworkStack
        networks={networks.slice(0, STACK_SIZE)}
        size={30}
        ringColor={palette.surface}
      />
      <View style={styles.words}>
        <Text variant="headline">Payers can pay from</Text>
        <Text variant="footnote" tone="secondary" numberOfLines={2}>
          {networkList(networks)}
        </Text>
      </View>
      <Icon name="chevronRight" size={14} color={palette.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
  },
  words: { flex: 1, gap: 2 },
});
