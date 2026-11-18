import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton } from "@/components/button";
import { Field } from "@/components/field";
import { Screen, ScreenHeader } from "@/components/screen";
import { Text } from "@/components/text";
import { meSchema, profileSchema } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { useSession } from "@/lib/session";

export default function NameScreen() {
  const { api } = useSession();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get("/api/me", meSchema).then((result) => {
      if (result.ok) {
        setName(result.value.user.displayName ?? "");
      }
    });
  }, [api]);

  async function save() {
    setPending(true);
    setError(null);
    const result = await api.put("/api/me/display-name", { displayName: name }, profileSchema);
    setPending(false);
    if (result.ok) {
      haptics.success();
      router.back();
    } else {
      haptics.warning();
      setError(result.message);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title="Save"
          pending={pending}
          disabled={name.trim() === ""}
          onPress={() => void save()}
        />
      }
    >
      <ScreenHeader
        leading={
          <IconButton
            icon="back"
            label="Back"
            onPress={() => {
              router.back();
            }}
          />
        }
      />
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          Name payers see
        </Text>
        <Text variant="body" tone="secondary">
          It shows on your page and on every request. Your email never does.
        </Text>
      </View>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        error={error}
        maxLength={50}
        autoFocus
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, paddingTop: 8 },
});
