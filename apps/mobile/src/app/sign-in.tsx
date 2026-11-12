import { product } from "@pomi/shared";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Body, Button, ErrorText, Field, styles, Title } from "@/components/ui";
import { useSession } from "@/lib/session";

export default function SignInScreen() {
  const { api, verifyCode } = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setPending(true);
    setError(null);
    const result = await api.postNoContent("/api/auth/code", { email });
    setPending(false);
    if (result.ok) {
      setSentTo(email.trim());
    } else {
      setError(result.message);
    }
  }

  async function signIn(address: string) {
    setPending(true);
    setError(null);
    const message = await verifyCode(address, code);
    setPending(false);
    if (message === null) {
      router.replace("/");
    } else {
      setError(message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Title>{product.name}</Title>
        <Body muted>{product.tagline}</Body>
        {sentTo === null ? (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
            <ErrorText message={error} />
            <Button title="Email me a code" pending={pending} onPress={() => void requestCode()} />
          </>
        ) : (
          <>
            <Body muted>We sent a 6-digit code to {sentTo}.</Body>
            <Field
              label="Code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={7}
            />
            <ErrorText message={error} />
            <Button title="Sign in" pending={pending} onPress={() => void signIn(sentTo)} />
            <Button
              title="Use another email"
              secondary
              onPress={() => {
                setSentTo(null);
                setCode("");
                setError(null);
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
