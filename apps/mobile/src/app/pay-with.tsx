import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AssetLogo, NetworkLogo } from "@/components/asset-logo";
import { IconButton } from "@/components/button";
import { Screen, ScreenHeader } from "@/components/screen";
import { RowSkeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { assetsSchema } from "@/lib/api";
import { networkInfo } from "@/lib/networks";
import { useApi } from "@/lib/use-api";
import { radius, usePalette } from "@/theme/theme";

// Every network and token a payer can use, straight from Useroutr's list.
export default function PayWithScreen() {
  const palette = usePalette();
  const assets = useApi("/api/assets", assetsSchema);
  const payWith = assets.data?.payWith;

  return (
    <Screen topInset={false}>
      <ScreenHeader
        leading={
          <IconButton
            icon="close"
            label="Close"
            onPress={() => {
              router.back();
            }}
          />
        }
        title="Ways to pay you"
      />
      <Text variant="body" tone="secondary">
        Payers can use any of these. Whatever they send, you receive exactly the asset you asked
        for, in your own wallet.
      </Text>
      {assets.error !== null && payWith === undefined ? (
        <Text variant="callout" tone="danger">
          {assets.error}
        </Text>
      ) : payWith === undefined ? (
        <View style={styles.list}>
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : (
        <View style={styles.list}>
          {payWith.map((entry) => (
            <View
              key={entry.network}
              style={[
                styles.network,
                { backgroundColor: palette.surface, borderColor: palette.line },
              ]}
            >
              <View style={styles.networkHeader}>
                <NetworkLogo network={entry.network} size={36} />
                <View style={styles.networkWords}>
                  <Text variant="headline">{networkInfo(entry.network).name}</Text>
                  <Text variant="footnote" tone="secondary">
                    {entry.symbols.length === 1
                      ? "1 token"
                      : `${String(entry.symbols.length)} tokens`}
                  </Text>
                </View>
              </View>
              <View style={styles.tokens}>
                {entry.symbols.map((symbol) => (
                  <View key={symbol} style={[styles.token, { backgroundColor: palette.fill }]}>
                    <AssetLogo symbol={symbol} size={22} />
                    <Text variant="label">{symbol}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  network: {
    gap: 14,
    padding: 16,
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
  },
  networkHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  networkWords: { gap: 2 },
  tokens: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  token: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    height: 30,
    borderRadius: radius.pill,
  },
});
