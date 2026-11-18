import { router } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import { displayLink, pageLink } from "@/lib/config";
import { haptics } from "@/lib/haptics";
import { useCopied } from "@/lib/use-copied";
import { radius } from "@/theme/theme";
import { Button } from "./button";
import { PomiMark } from "./logo";
import { PressableScale } from "./pressable-scale";
import { QrCode } from "./qr-code";
import { Text } from "./text";
import { VibrantSurface } from "./vibrant-surface";

// The receiver's own page, the one link that always works, laid out the way
// payment apps show a person's code: who it is, the link, a QR code someone
// in front of you can scan at once, and the two ways to send it. It is the
// one vibrant card on Home; the code keeps its white tile, so it scans.
export function PageCard({ handle }: { handle: string }) {
  const link = pageLink(handle);
  const { copied, copy } = useCopied();

  return (
    <VibrantSurface radius={radius.card} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.words}>
          <View style={styles.label}>
            <PomiMark size={16} color="#FFFFFF" />
            <Text variant="label" style={styles.soft}>
              Your page
            </Text>
          </View>
          <Text variant="title2" numberOfLines={1} adjustsFontSizeToFit style={styles.white}>
            {displayLink(link)}
          </Text>
          <Text variant="footnote" style={styles.soft}>
            Anyone can pay you here, from any wallet.
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Show your page's QR code"
          onPress={() => {
            router.push({ pathname: "/page-qr" });
          }}
          style={styles.qr}
        >
          <QrCode value={link} size={84} />
        </PressableScale>
      </View>
      <View style={styles.actions}>
        <Button
          title={copied ? "Copied" : "Copy link"}
          icon={copied ? "check" : "copy"}
          variant="glass"
          size="medium"
          style={styles.action}
          onPress={() => {
            copy(link);
          }}
        />
        <Button
          title="Share"
          icon="share"
          variant="inverse"
          size="medium"
          style={styles.action}
          onPress={() => {
            haptics.tap();
            void Share.share({ message: link, url: link });
          }}
        />
      </View>
    </VibrantSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 18 },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  words: { flex: 1, gap: 4 },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  white: { color: "#FFFFFF" },
  soft: { color: "rgba(255, 255, 255, 0.86)" },
  qr: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    boxShadow: "0 8px 20px -10px rgba(20, 10, 40, 0.5)",
  },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
});
