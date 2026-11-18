import { networkName } from "@pomi/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, IconButton } from "@/components/button";
import { Field } from "@/components/field";
import { Screen, ScreenHeader } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Text } from "@/components/text";
import { assetsSchema, payBoxSchema, type RequestableAsset } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { useSession } from "@/lib/session";

type Kind = "any" | "fixed";

const KINDS = [
  { value: "any", label: "Payer chooses" },
  { value: "fixed", label: "Fixed amount" },
] as const;

// The pay box sits on the receiver's page: a standing way to be paid,
// without making a request each time.
export default function PayBoxScreen() {
  const { api } = useSession();
  const [assets, setAssets] = useState<RequestableAsset[] | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("any");
  const [amount, setAmount] = useState("");
  const [minimum, setMinimum] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api.get("/api/assets", assetsSchema),
      api.get("/api/me/pay-box", payBoxSchema),
    ]).then(([assetList, box]) => {
      if (assetList.ok) {
        setAssets(assetList.value.assets);
        setAssetId(assetList.value.assets[0]?.id ?? null);
      }
      if (box.ok && box.value.payBox !== null) {
        const saved = box.value.payBox;
        setOpen(saved.open);
        setAssetId(saved.assetId);
        setKind(saved.amount === null ? "any" : "fixed");
        setAmount(saved.amount ?? "");
        setMinimum(saved.minimumAmount ?? "");
      }
    });
  }, [api]);

  async function save() {
    if (assetId === null) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await api.put(
      "/api/me/pay-box",
      kind === "fixed"
        ? { assetId, amount }
        : { assetId, ...(minimum.trim() === "" ? {} : { minimumAmount: minimum }) },
      payBoxSchema,
    );
    setPending(false);
    if (result.ok) {
      haptics.success();
      router.back();
    } else {
      haptics.warning();
      setError(result.message);
    }
  }

  async function turnOff() {
    setPending(true);
    const result = await api.delete("/api/me/pay-box");
    setPending(false);
    if (result.ok) {
      haptics.success();
      router.back();
    } else {
      setError(result.message);
    }
  }

  const manyNetworks = new Set(assets?.map((asset) => asset.network)).size > 1;
  const ready = assetId !== null && (kind === "any" || amount.trim() !== "");

  return (
    <Screen
      footer={
        <>
          <Button
            title={open ? "Save" : "Turn on the pay box"}
            pending={pending}
            disabled={!ready}
            onPress={() => void save()}
          />
          {open && (
            <Button
              title="Turn it off"
              variant="destructive"
              size="medium"
              onPress={() => void turnOff()}
            />
          )}
        </>
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
          Pay box
        </Text>
        <Text variant="body" tone="secondary">
          A standing way to pay you, right on your page. No request needed.
        </Text>
      </View>

      {assets !== null && assets.length > 1 && assetId !== null && (
        <View style={styles.block}>
          <Text variant="label" tone="secondary">
            Paid in
          </Text>
          <Segmented
            options={assets.map((asset) => ({
              value: asset.id,
              // USDC can be on more than one network, so each says which.
              label: manyNetworks
                ? `${asset.symbol} · ${networkName(asset.network)}`
                : asset.symbol,
            }))}
            value={assetId}
            onChange={setAssetId}
            label="Paid in"
            stretch
          />
        </View>
      )}
      <View style={styles.block}>
        <Text variant="label" tone="secondary">
          Amount
        </Text>
        <Segmented options={KINDS} value={kind} onChange={setKind} label="Amount" stretch />
      </View>
      {kind === "fixed" ? (
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="10"
        />
      ) : (
        <Field
          label="Smallest amount, optional"
          value={minimum}
          onChangeText={setMinimum}
          keyboardType="decimal-pad"
          placeholder="1"
          hint="Leave it empty to take any amount."
        />
      )}
      {error !== null && (
        <Text variant="callout" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10, paddingTop: 8 },
  block: { gap: 10 },
});
