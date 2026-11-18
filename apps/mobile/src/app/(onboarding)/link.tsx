import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Icon } from "@/components/icon";
import { Orb } from "@/components/orb";
import { Screen, ScreenHeader } from "@/components/screen";
import { Steps } from "@/components/steps";
import { Text } from "@/components/text";
import { handleAvailabilitySchema, profileSchema } from "@/lib/api";
import { pageHost } from "@/lib/config";
import { haptics } from "@/lib/haptics";
import { useSession } from "@/lib/session";
import { radius, usePalette } from "@/theme/theme";

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free" }
  | { state: "unavailable"; problem: string };

// A first suggestion from the name: "Ada Obi" offers "ada".
function suggestHandle(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

export default function LinkScreen() {
  const { api } = useSession();
  const palette = usePalette();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [edited, setEdited] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownHandle = edited ? handle : suggestHandle(name);

  // Asked a moment after typing stops, not on every key.
  useEffect(() => {
    if (shownHandle.length === 0) {
      setCheck({ state: "idle" });
      return;
    }
    setCheck({ state: "checking" });
    const timer = setTimeout(() => {
      void api
        .get(`/api/handles/${encodeURIComponent(shownHandle)}`, handleAvailabilitySchema)
        .then((result) => {
          if (!result.ok) {
            setCheck({ state: "idle" });
          } else if (result.value.available) {
            setCheck({ state: "free" });
          } else {
            setCheck({ state: "unavailable", problem: result.value.problem ?? "Try another." });
          }
        });
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [api, shownHandle]);

  async function claim() {
    setPending(true);
    setError(null);
    const named = await api.put("/api/me/display-name", { displayName: name }, profileSchema);
    const claimed = named.ok
      ? await api.post("/api/me/handle", { handle: shownHandle }, profileSchema)
      : named;
    setPending(false);
    if (!claimed.ok) {
      haptics.warning();
      setError(claimed.message);
      return;
    }
    haptics.success();
    router.replace({ pathname: "/payout", params: { onboarding: "1" } });
  }

  const ready = name.trim().length > 0 && check.state === "free";

  return (
    <Screen
      footer={
        <Button
          title={shownHandle === "" ? "Claim your link" : `Claim ${pageHost()}/${shownHandle}`}
          pending={pending}
          disabled={!ready}
          onPress={() => void claim()}
        />
      }
    >
      <ScreenHeader trailing={<Steps current={3} />} />
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          Claim your link
        </Text>
        <Text variant="body" tone="secondary">
          Anyone can pay you here. Share it once and it keeps working.
        </Text>
      </View>

      <Field
        label="Name payers see"
        value={name}
        onChangeText={setName}
        placeholder="Ada Obi"
        autoFocus
        autoComplete="name"
        textContentType="name"
        maxLength={50}
        returnKeyType="next"
      />
      <Field
        label="Your link"
        prefix={`${pageHost()}/`}
        value={shownHandle}
        onChangeText={(text) => {
          setEdited(true);
          setHandle(text.toLowerCase().replace(/\s/g, ""));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={30}
        error={check.state === "unavailable" ? check.problem : error}
        accessory={
          check.state === "checking" ? (
            <ActivityIndicator color={palette.textSecondary} />
          ) : check.state === "free" ? (
            <Icon name="checkCircle" size={22} color={palette.paid.foreground} />
          ) : null
        }
        hint={
          check.state === "free" ? (
            <Text variant="footnote" tone="paid" style={styles.strong}>
              It's free. It can't be changed later, so links you share keep working.
            </Text>
          ) : (
            "Lowercase letters, digits and hyphens."
          )
        }
      />

      <View style={styles.preview}>
        <Text variant="label" tone="secondary">
          What payers will see
        </Text>
        <View
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}
        >
          <Orb size={48} glow={false}>
            <Text variant="section" style={styles.initial}>
              {(name.trim()[0] ?? "P").toUpperCase()}
            </Text>
          </Orb>
          <View style={styles.cardText}>
            <Text variant="section" numberOfLines={1}>
              {name.trim() === "" ? "Your name" : name.trim()}
            </Text>
            <Text variant="callout" tone="secondary" numberOfLines={1}>
              {pageHost()}/{shownHandle === "" ? "you" : shownHandle}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, paddingTop: 8 },
  strong: { fontWeight: "600" },
  preview: { gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: { flex: 1, gap: 2 },
  initial: { color: "#FFFFFF" },
});
