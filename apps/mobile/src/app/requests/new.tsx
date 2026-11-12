import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Body, Button, ErrorText, Field, styles, useColors } from "@/components/ui";
import { assetsSchema, createdRequestSchema } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function NewRequestScreen() {
  const { api } = useSession();
  const colors = useColors();
  const [assets, setAssets] = useState<{ id: string; symbol: string }[]>([]);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reusable, setReusable] = useState(false);
  const [listed, setListed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get("/api/assets", assetsSchema).then((result) => {
      if (result.ok) {
        setAssets(result.value.assets);
        setAssetId(result.value.assets[0]?.id ?? null);
      } else {
        setError(result.message);
      }
    });
  }, [api]);

  async function create() {
    if (assetId === null) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await api.post(
      "/api/requests",
      { amount, assetId, note, reusable, listed },
      createdRequestSchema,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace({ pathname: "/requests/[id]", params: { id: result.value.request.id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Field
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="25"
      />
      <View style={styles.row}>
        {assets.map((asset) => (
          <Pressable
            key={asset.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: asset.id === assetId }}
            onPress={() => {
              setAssetId(asset.id);
            }}
            style={[
              styles.button,
              {
                borderWidth: 1,
                borderColor: asset.id === assetId ? colors.foreground : colors.border,
              },
            ]}
          >
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>{asset.symbol}</Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="What it is for (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={280}
        placeholder="Logo design"
      />
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Body>Reusable: paid any number of times</Body>
        <Switch value={reusable} onValueChange={setReusable} />
      </View>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Body>Show it on my page</Body>
        <Switch value={listed} onValueChange={setListed} />
      </View>
      <ErrorText message={error} />
      <Button
        title="Create request"
        pending={pending}
        disabled={assetId === null}
        onPress={() => void create()}
      />
    </ScrollView>
  );
}
