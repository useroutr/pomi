import { ClipboardPasteButton } from "expo-clipboard";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { type ClipboardOffer } from "@/lib/clipboard-offer";
import { useReduceMotion } from "@/lib/reduce-motion";
import { radius, usePalette } from "@/theme/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";

// A quiet card offering what was just copied. On iOS the button is Apple's
// own Paste control: it cannot be restyled beyond its colors, and it is what
// lets Pomi paste without the system asking for permission first.
export function PasteOffer({
  offer,
  title,
  description,
  onPaste,
}: {
  offer: ClipboardOffer;
  title: string;
  description: string;
  onPaste: (text: string) => void;
}) {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      appear.setValue(1);
      return;
    }
    Animated.spring(appear, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  }, [appear, reduceMotion]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.line },
        {
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: palette.fill }]}>
        <Icon name="paste" size={16} color={palette.text} />
      </View>
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={2}>
          {description}
        </Text>
      </View>
      {offer.kind === "paste-control" ? (
        <ClipboardPasteButton
          acceptedContentTypes={["plain-text"]}
          displayMode="iconAndLabel"
          cornerStyle="capsule"
          backgroundColor={palette.primary}
          foregroundColor={palette.onPrimary}
          style={styles.pasteControl}
          onPress={(data) => {
            if (data.type === "text") {
              onPaste(data.text);
            }
          }}
        />
      ) : (
        <Button
          title="Paste"
          icon="paste"
          size="small"
          onPress={() => {
            onPaste(offer.value);
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 1 },
  pasteControl: { width: 96, height: 36 },
});
