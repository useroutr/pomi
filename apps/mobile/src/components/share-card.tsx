import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { displayLink } from "@/lib/config";
import { haptics } from "@/lib/haptics";
import { QR_COLORWAYS, type QrColorway } from "@/theme/palette";
import { radius } from "@/theme/theme";
import { DISPLAY_FONTS } from "@/theme/type";
import { Icon } from "./icon";
import { PressableScale } from "./pressable-scale";
import { QrCode } from "./qr-code";
import { Text } from "./text";

// A link to share, laid out as Linktree lays out its QR cards: one light
// color, the person on top, the code drawn straight onto the card, and the
// link under it, all in the card's ink. Tapping the link copies it.
export function ShareCard({
  link,
  title,
  subtitle,
  initial,
  colorway = QR_COLORWAYS[0],
}: {
  link: string;
  title: string;
  subtitle?: string;
  // The receiver's initial, for a card that stands for a person's page.
  initial?: string;
  colorway?: QrColorway;
}) {
  const { width } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const qrSize = Math.min(width - 132, 236);
  const { card, ink } = colorway;
  return (
    <View style={[styles.card, { backgroundColor: card }]}>
      {initial !== undefined && (
        <View style={[styles.avatar, { backgroundColor: ink }]}>
          <Text style={[styles.initial, { color: card }]}>{initial}</Text>
        </View>
      )}
      <QrCode value={link} size={qrSize} ink={ink} ground={card} quietZone={1} />
      <View style={styles.words}>
        <Text variant="title2" style={[styles.center, { color: ink }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text
            variant="callout"
            style={[styles.center, styles.soft, { color: ink }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copied ? "Link copied" : `Copy ${displayLink(link)}`}
        onPress={() => {
          void Clipboard.setStringAsync(link).then(() => {
            haptics.success();
            setCopied(true);
          });
        }}
        style={[styles.linkPill, { borderColor: ink }]}
      >
        <Text numberOfLines={1} style={[styles.linkText, { color: ink }]}>
          {copied ? "Copied" : displayLink(link)}
        </Text>
        <Icon name={copied ? "check" : "copy"} size={15} color={ink} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: radius.sheet,
    boxShadow: "0 18px 40px -20px rgba(26, 22, 32, 0.35)",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: DISPLAY_FONTS.bold, fontSize: 24, lineHeight: 28 },
  words: { alignItems: "center", gap: 4 },
  center: { textAlign: "center" },
  soft: { opacity: 0.78 },
  linkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    maxWidth: "100%",
  },
  linkText: { flexShrink: 1, fontFamily: DISPLAY_FONTS.semibold, fontSize: 15 },
});
