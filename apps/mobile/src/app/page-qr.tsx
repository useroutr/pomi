import { router } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Button, IconButton } from "@/components/button";
import { PressableScale } from "@/components/pressable-scale";
import { Screen, ScreenHeader } from "@/components/screen";
import { ShareCard } from "@/components/share-card";
import { Skeleton } from "@/components/skeleton";
import { meSchema } from "@/lib/api";
import { pageLink } from "@/lib/config";
import { haptics } from "@/lib/haptics";
import { useApi } from "@/lib/use-api";
import { QR_COLORWAYS, type QrColorway } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

// The receiver's page as a QR code, to show on a counter, a stall or a slide,
// on a card in the color they pick.
export default function PageQrScreen() {
  const me = useApi("/api/me", meSchema);
  const [colorway, setColorway] = useState<QrColorway>(QR_COLORWAYS[0]);
  const user = me.data?.user;
  const link = user?.handle === null || user?.handle === undefined ? null : pageLink(user.handle);
  const name = user?.displayName ?? user?.handle ?? "Your page";

  return (
    <Screen
      topInset={false}
      footer={
        link === null ? undefined : (
          <Button
            title="Share link"
            icon="share"
            onPress={() => void Share.share({ message: link, url: link })}
          />
        )
      }
    >
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
        title="Your page"
      />
      {link === null || user === undefined ? (
        <Skeleton style={styles.skeleton} />
      ) : (
        <>
          <ShareCard
            link={link}
            title={name}
            subtitle="Scan to pay me with any token"
            initial={(name.trim()[0] ?? "P").toUpperCase()}
            colorway={colorway}
          />
          <Swatches value={colorway} onChange={setColorway} />
        </>
      )}
    </Screen>
  );
}

function Swatches({
  value,
  onChange,
}: {
  value: QrColorway;
  onChange: (colorway: QrColorway) => void;
}) {
  const palette = usePalette();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Card color" style={styles.swatches}>
      {QR_COLORWAYS.map((colorway) => {
        const selected = colorway.name === value.name;
        return (
          <PressableScale
            key={colorway.name}
            accessibilityRole="radio"
            accessibilityLabel={colorway.name}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                haptics.select();
                onChange(colorway);
              }
            }}
            style={[
              styles.swatch,
              {
                borderColor: selected ? palette.focus : palette.line,
                borderWidth: selected ? 3 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View style={[styles.swatchFill, { backgroundColor: colorway.card }]}>
              <View style={[styles.swatchInk, { backgroundColor: colorway.ink }]} />
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 460, borderRadius: 28 },
  swatches: { flexDirection: "row", justifyContent: "center", gap: 14 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchFill: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchInk: { width: 12, height: 12, borderRadius: 6 },
});
