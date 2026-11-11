import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Body, Button, Card, ErrorText, Field, styles, Title } from "@/components/ui";
import { meSchema, payoutAddressSchema, profileSchema } from "@/lib/api";
import { pageLink } from "@/lib/config";
import { useSession } from "@/lib/session";

export default function SettingsScreen() {
  const { api, signOut } = useSession();
  const scanned = useLocalSearchParams<{ address?: string }>().address;
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [payoutAddress, setPayoutAddress] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [me, address] = await Promise.all([
      api.get("/api/me", meSchema),
      api.get("/api/me/payout-address", payoutAddressSchema),
    ]);
    if (me.ok) {
      setEmail(me.value.user.email);
      setHandle(me.value.user.handle);
      setDisplayName(me.value.user.displayName ?? "");
    }
    if (address.ok) {
      setPayoutAddress(address.value.payoutAddress?.address ?? null);
    }
    setError(me.ok ? (address.ok ? null : address.message) : me.message);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scanned !== undefined) {
      setAddressInput(scanned);
    }
  }, [scanned]);

  async function run(action: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await action();
    setPending(false);
    if (result.ok) {
      setNotice(done);
      await load();
    } else {
      setError(result.message ?? "Something went wrong. Try again.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Body muted>Signed in as {email}</Body>

      <Card>
        <Title>Your page</Title>
        {handle === null ? (
          <>
            <Field
              label="Handle"
              value={handleInput}
              onChangeText={setHandleInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your-name"
            />
            <Body muted>It cannot be changed later.</Body>
            <Button
              title="Claim"
              pending={pending}
              onPress={() =>
                void run(
                  () => api.post("/api/me/handle", { handle: handleInput }, profileSchema),
                  "Your page is ready.",
                )
              }
            />
          </>
        ) : (
          <>
            <Body>{pageLink(handle)}</Body>
            <Button
              title="Copy page link"
              secondary
              onPress={() => void Clipboard.setStringAsync(pageLink(handle))}
            />
          </>
        )}
        <Field
          label="Name shown to payers"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={50}
        />
        <Button
          title="Save name"
          secondary
          pending={pending}
          onPress={() =>
            void run(
              () => api.put("/api/me/display-name", { displayName }, profileSchema),
              "Name saved.",
            )
          }
        />
      </Card>

      <Card>
        <Title>Where you get paid</Title>
        {payoutAddress !== null && <Body>{payoutAddress}</Body>}
        <Field
          label={payoutAddress === null ? "Your Stellar address" : "A new address"}
          value={addressInput}
          onChangeText={setAddressInput}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="G..."
        />
        <View style={styles.row}>
          <Button
            title="Save address"
            pending={pending}
            onPress={() =>
              void run(
                () =>
                  api.put("/api/me/payout-address", { address: addressInput }, payoutAddressSchema),
                "Address saved.",
              )
            }
          />
          <Button
            title="Scan"
            secondary
            onPress={() => {
              router.push({ pathname: "/scan", params: { for: "address" } });
            }}
          />
        </View>
        <Body muted>Use an address from your own wallet, not an exchange.</Body>
      </Card>

      {notice !== null && <Body>{notice}</Body>}
      <ErrorText message={error} />
      <Button
        title="Sign out"
        secondary
        onPress={() =>
          void signOut().then(() => {
            router.replace("/sign-in");
          })
        }
      />
    </ScrollView>
  );
}
