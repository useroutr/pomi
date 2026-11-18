import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton } from "@/components/button";
import { Field } from "@/components/field";
import { Screen, ScreenHeader } from "@/components/screen";
import { Steps } from "@/components/steps";
import { Text } from "@/components/text";
import { haptics } from "@/lib/haptics";
import { useSession } from "@/lib/session";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const { api } = useSession();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = email.trim();

  async function sendCode() {
    setPending(true);
    setError(null);
    const result = await api.postNoContent("/api/auth/code", { email: address });
    setPending(false);
    if (result.ok) {
      router.push({ pathname: "/code", params: { email: address } });
    } else {
      haptics.warning();
      setError(result.message);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title="Send code"
          pending={pending}
          disabled={!EMAIL_SHAPE.test(address)}
          onPress={() => void sendCode()}
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
        trailing={<Steps current={1} />}
      />
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          What's your email?
        </Text>
        <Text variant="body" tone="secondary">
          We'll send you a 6-digit code. There's no password to remember.
        </Text>
      </View>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        hint="New here or coming back, it's the same step."
        placeholder="you@example.com"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => {
          if (EMAIL_SHAPE.test(address)) {
            void sendCode();
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, paddingTop: 8 },
});
