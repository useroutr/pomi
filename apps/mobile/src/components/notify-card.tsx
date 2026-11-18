import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { enableNotifications, notificationPermission } from "@/lib/push";
import { useSession } from "@/lib/session";
import { radius, usePalette } from "@/theme/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { Illustration } from "./illustration";
import { Text } from "./text";

// Shown after a request is made, the moment "know when you're paid" means
// something. One button, which opens the system's own prompt. Hidden once
// the receiver has answered either way.
export function NotifyCard() {
  const { api } = useSession();
  const palette = usePalette();
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void notificationPermission().then((permission) => {
      setVisible(permission === "undetermined");
    });
  }, []);

  if (!visible) {
    return null;
  }
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      {done ? (
        <View style={[styles.icon, { backgroundColor: palette.paid.background }]}>
          <Icon name="check" size={18} color={palette.paid.foreground} />
        </View>
      ) : (
        <Illustration name="bellHeart" size={52} />
      )}
      <View style={styles.words}>
        <Text variant="headline">
          {done ? "You'll know when you're paid" : "Know the moment you're paid"}
        </Text>
        <Text variant="footnote" tone="secondary">
          Only payments. Nothing else.
        </Text>
      </View>
      {!done && (
        <Button
          title="Turn on"
          variant="secondary"
          size="small"
          onPress={() => {
            void enableNotifications(api).then((granted) => {
              if (granted) {
                setDone(true);
              } else {
                setVisible(false);
              }
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  words: { flex: 1, gap: 2 },
});
