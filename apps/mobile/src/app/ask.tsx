import { networkName, parseRequestAmount } from "@pomi/shared";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";
import { AmountDisplay } from "@/components/amount-display";
import { AssetLogo, AssetMark, NetworkStack } from "@/components/asset-logo";
import { Button, IconButton } from "@/components/button";
import { Field } from "@/components/field";
import { Group, SwitchRow } from "@/components/group";
import { Icon, type IconName } from "@/components/icon";
import { Keypad } from "@/components/keypad";
import { NotifyCard } from "@/components/notify-card";
import { PressableScale } from "@/components/pressable-scale";
import { Screen, ScreenHeader } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { ShareCard } from "@/components/share-card";
import { StepFrame } from "@/components/step-frame";
import { Text } from "@/components/text";
import {
  assetsSchema,
  createdRequestSchema,
  type PaymentNetwork,
  type Readiness,
  readinessSchema,
  type RequestableAsset,
} from "@/lib/api";
import { requestLink } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { networkList } from "@/lib/networks";
import { useSession } from "@/lib/session";
import { BRAND_SCREEN_GRADIENT, BRAND_VIOLET } from "@/theme/palette";
import { radius, usePalette } from "@/theme/theme";

type Step = "amount" | "details" | "ready";
type Ends = "never" | "day" | "week" | "month";

const ENDS = [
  { value: "never", label: "Never" },
  { value: "day", label: "1 day" },
  { value: "week", label: "1 week" },
  { value: "month", label: "1 month" },
] as const;

const ENDS_IN_DAYS: Record<Ends, number | null> = { never: null, day: 1, week: 7, month: 30 };

// Asking for money, in the order people think of it: how much, what for,
// then the link to share. One sheet, three steps.
export default function AskScreen() {
  const { api } = useSession();
  const palette = usePalette();
  const [step, setStep] = useState<Step>("amount");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [assets, setAssets] = useState<RequestableAsset[] | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetChosen, setAssetChosen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [reusable, setReusable] = useState(false);
  const [listed, setListed] = useState(false);
  const [ends, setEnds] = useState<Ends>("never");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [payWith, setPayWith] = useState<PaymentNetwork[]>([]);

  useEffect(() => {
    void api.get("/api/assets", assetsSchema).then((result) => {
      if (result.ok) {
        setAssets(result.value.assets);
        setPayWith(result.value.payWith);
        const preferred =
          result.value.assets.find((asset) => asset.symbol === "USDC") ?? result.value.assets[0];
        setAssetId(preferred?.id ?? null);
      } else {
        setError(result.message);
      }
    });
  }, [api]);

  // Checked in the background, and again on coming back from adding an
  // address: it reads the receiver's account on Stellar.
  useFocusEffect(
    useCallback(() => {
      void api.get("/api/me/payout-address/readiness", readinessSchema).then((result) => {
        if (result.ok) {
          setReadiness(result.value);
        }
      });
    }, [api]),
  );

  // Until the receiver picks one, start on an asset their wallet can
  // already receive: on Stellar, USDC needs a trustline that XLM does not.
  const firstReady = readiness?.assets.find((candidate) => candidate.ready);
  const shownAssetId =
    !assetChosen &&
    firstReady !== undefined &&
    readiness?.assets.some((candidate) => candidate.id === assetId && !candidate.ready) === true
      ? firstReady.id
      : assetId;
  const asset = assets?.find((candidate) => candidate.id === shownAssetId);
  const assetReadiness = readiness?.assets.find((candidate) => candidate.id === shownAssetId);
  const missingAddress =
    readiness !== null &&
    asset !== undefined &&
    !readiness.payoutAddresses.some((saved) => saved.network === asset.network);
  const manyNetworks = new Set(assets?.map((candidate) => candidate.network)).size > 1;

  function go(next: Step, towards: 1 | -1) {
    setDirection(towards);
    setStep(next);
  }

  async function create() {
    if (asset === undefined) {
      return;
    }
    setPending(true);
    setError(null);
    const days = ENDS_IN_DAYS[ends];
    const result = await api.post(
      "/api/requests",
      {
        amount,
        assetId: asset.id,
        note,
        reusable,
        listed,
        ...(days === null
          ? {}
          : { endsAt: new Date(Date.now() + days * 86_400_000).toISOString() }),
      },
      createdRequestSchema,
    );
    setPending(false);
    if (!result.ok) {
      haptics.warning();
      setError(result.message);
      return;
    }
    haptics.success();
    setCreated(result.value.request.id);
    go("ready", 1);
  }

  if (step === "amount") {
    return (
      <StepFrame key="amount" direction={direction}>
        <AmountStep
          assets={assets}
          asset={asset}
          assetProblem={assetReadiness?.ready === false ? assetReadiness.problem : null}
          missingAddress={missingAddress}
          manyNetworks={manyNetworks}
          payWith={payWith}
          amount={amount}
          onAmount={setAmount}
          onAsset={(id) => {
            setAssetChosen(true);
            setAssetId(id);
          }}
          onNext={() => {
            go("details", 1);
          }}
        />
      </StepFrame>
    );
  }
  if (step === "details") {
    return (
      <StepFrame key="details" direction={direction}>
        <Screen
          topInset={false}
          footer={<Button title="Create request" pending={pending} onPress={() => void create()} />}
        >
          <ScreenHeader
            leading={
              <IconButton
                icon="back"
                label="Back to the amount"
                onPress={() => {
                  go("amount", -1);
                }}
              />
            }
          />
          <View style={styles.summary}>
            <Text variant="label" tone="secondary">
              Asking for
            </Text>
            <View style={styles.summaryAmount}>
              {asset !== undefined && (
                <AssetMark
                  symbol={asset.symbol}
                  network={asset.network}
                  size={32}
                  ringColor={palette.background}
                />
              )}
              <Text variant="title" accessibilityRole="header" style={styles.summaryText}>
                {formatAmount(amount)} {asset?.symbol}
                {asset !== undefined && manyNetworks ? ` on ${networkName(asset.network)}` : ""}
              </Text>
            </View>
          </View>
          <Field
            label="What's it for? Optional"
            value={note}
            onChangeText={setNote}
            placeholder="Logo design for Kemi"
            maxLength={280}
            multiline
            hint="Payers see this note next to the amount."
          />
          <View style={styles.choiceGroup}>
            <Text variant="label" tone="secondary">
              How many times can it be paid?
            </Text>
            <View style={styles.choices}>
              <Choice
                title="Once"
                detail="Like an invoice. Closes when paid."
                selected={!reusable}
                onPress={() => {
                  setReusable(false);
                }}
              />
              <Choice
                title="Many times"
                detail="Dues, tips, a shop item."
                selected={reusable}
                onPress={() => {
                  setReusable(true);
                }}
              />
            </View>
          </View>
          <Group>
            <SwitchRow
              label="Show on my page"
              detail="Otherwise only the link opens it"
              value={listed}
              onChange={setListed}
            />
          </Group>
          <View style={styles.choiceGroup}>
            <Text variant="label" tone="secondary">
              Stops taking payments
            </Text>
            <Segmented
              options={ENDS}
              value={ends}
              onChange={setEnds}
              label="Stops taking payments"
              stretch
            />
          </View>
          {error !== null && (
            <Text variant="callout" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </Screen>
      </StepFrame>
    );
  }
  const link = requestLink(created ?? "");
  return (
    <StepFrame key="ready" direction={direction}>
      <Screen
        topInset={false}
        footer={
          <>
            <Button
              title="Share link"
              icon="share"
              onPress={() => void Share.share({ message: link, url: link })}
            />
            <Button
              title="See the pay page"
              variant="plain"
              size="medium"
              onPress={() => void WebBrowser.openBrowserAsync(link)}
            />
          </>
        }
      >
        <ScreenHeader
          leading={
            <Text variant="title2" accessibilityRole="header">
              Ready to share
            </Text>
          }
          trailing={
            <Button
              title="Done"
              variant="secondary"
              size="small"
              onPress={() => {
                router.back();
              }}
            />
          }
        />
        <ShareCard
          link={link}
          title={`${formatAmount(amount)} ${asset?.symbol ?? ""}${
            asset !== undefined && manyNetworks ? ` on ${networkName(asset.network)}` : ""
          }`}
          subtitle={note.trim() === "" ? undefined : note.trim()}
        />
        <NotifyCard />
      </Screen>
    </StepFrame>
  );
}

function AmountStep({
  assets,
  asset,
  assetProblem,
  missingAddress,
  manyNetworks,
  payWith,
  amount,
  onAmount,
  onAsset,
  onNext,
}: {
  assets: RequestableAsset[] | null;
  asset: RequestableAsset | undefined;
  assetProblem: string | null;
  // No address saved yet on the chosen asset's network.
  missingAddress: boolean;
  // The assets on offer sit on more than one network, so each says which.
  manyNetworks: boolean;
  payWith: PaymentNetwork[];
  amount: string;
  onAmount: (amount: string) => void;
  onAsset: (id: string) => void;
  onNext: () => void;
}) {
  const tooPrecise = asset !== undefined && decimalPlaces(amount) > asset.decimals;
  const valid = isRequestAmount(amount) && !tooPrecise;
  const [refusals, setRefusals] = useState(0);
  const networks = payWith.map((entry) => entry.network);
  const assetName =
    asset === undefined
      ? "it"
      : manyNetworks
        ? `${asset.symbol} on ${networkName(asset.network)}`
        : asset.symbol;

  // The whole screen in the brand colors, as the big money apps paint their
  // amount screens: the number is the only thing on it that matters.
  return (
    <Screen
      scroll={false}
      topInset={false}
      backgroundStyle={styles.brandScreen}
      footer={
        missingAddress && asset !== undefined ? (
          <Button
            title={`Add your ${networkName(asset.network)} address`}
            variant="inverse"
            onPress={() => {
              router.push({ pathname: "/payout", params: { network: asset.network } });
            }}
          />
        ) : (
          <Button
            title="Next"
            variant="inverse"
            disabled={!valid || asset === undefined || assetProblem !== null}
            onPress={onNext}
          />
        )
      }
    >
      <ScreenHeader
        leading={
          <IconButton
            icon="close"
            label="Close"
            tone="onDark"
            onPress={() => {
              router.back();
            }}
          />
        }
        title="Ask for money"
        titleColor="#FFFFFF"
      />
      {assets !== null && assets.length > 1 && asset !== undefined && (
        <AssetPills
          assets={assets}
          selectedId={asset.id}
          showNetwork={manyNetworks}
          onSelect={onAsset}
        />
      )}
      <View style={styles.display}>
        <AmountDisplay
          amount={amount}
          symbol={asset?.symbol ?? ""}
          refusals={refusals}
          color="#FFFFFF"
        />
        {missingAddress && asset !== undefined ? (
          <BrandHint
            icon="warning"
            text={`Add the ${networkName(asset.network)} address you'll be paid at first.`}
          />
        ) : tooPrecise ? (
          <BrandHint
            icon="warning"
            text={`${assetName} takes at most ${String(asset.decimals)} decimal places.`}
          />
        ) : assetProblem !== null && asset !== undefined ? (
          <PressableScale
            accessibilityRole="button"
            onPress={() => {
              Alert.alert(`${asset.symbol} isn't ready yet`, assetProblem);
            }}
          >
            <BrandHint
              icon="warning"
              text={`Add ${asset.symbol} in your wallet first. Tap for how.`}
            />
          </PressableScale>
        ) : networks.length > 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityHint="Shows every network and token payers can use"
            onPress={() => {
              router.push("/pay-with");
            }}
          >
            <View style={styles.brandHint}>
              <NetworkStack networks={networks.slice(0, 4)} size={22} ringColor="transparent" />
              <Text variant="footnote" style={styles.brandHintText}>
                {`They pay from ${networkList(networks)}. You get ${assetName}.`}
              </Text>
            </View>
          </PressableScale>
        ) : null}
      </View>
      <Keypad
        value={amount}
        maxDecimals={asset?.decimals}
        light
        onChange={onAmount}
        onRefuse={() => {
          setRefusals((count) => count + 1);
        }}
      />
    </Screen>
  );
}

function AssetPills({
  assets,
  selectedId,
  showNetwork,
  onSelect,
}: {
  assets: RequestableAsset[];
  selectedId: string;
  showNetwork: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Get paid in"
      style={styles.pillStrip}
      contentContainerStyle={styles.pills}
    >
      {assets.map((candidate) => {
        const selected = candidate.id === selectedId;
        const color = selected ? BRAND_VIOLET : "#FFFFFF";
        return (
          <PressableScale
            key={candidate.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={
              showNetwork
                ? `${candidate.symbol} on ${networkName(candidate.network)}`
                : candidate.symbol
            }
            onPress={() => {
              if (!selected) {
                haptics.select();
                onSelect(candidate.id);
              }
            }}
            style={[styles.pill, selected ? styles.pillSelected : styles.pillIdle]}
          >
            {showNetwork ? (
              <AssetMark
                symbol={candidate.symbol}
                network={candidate.network}
                size={28}
                ringColor={selected ? "#FFFFFF" : "transparent"}
              />
            ) : (
              <AssetLogo symbol={candidate.symbol} size={28} />
            )}
            <View>
              <Text variant="headline" style={[styles.pillSymbol, { color }]}>
                {candidate.symbol}
              </Text>
              {showNetwork && (
                <Text variant="caption" style={[styles.pillNetwork, { color }]}>
                  {networkName(candidate.network)}
                </Text>
              )}
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function BrandHint({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.brandHint}>
      <Icon name={icon} size={16} color="#FFFFFF" />
      <Text variant="footnote" style={styles.brandHintText}>
        {text}
      </Text>
    </View>
  );
}

function decimalPlaces(amount: string): number {
  return amount.split(".")[1]?.length ?? 0;
}

function isRequestAmount(amount: string): boolean {
  try {
    parseRequestAmount(amount);
    return true;
  } catch {
    return false;
  }
}

function Choice({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        if (!selected) {
          haptics.select();
        }
        onPress();
      }}
      style={[
        styles.choice,
        {
          backgroundColor: palette.surface,
          borderColor: selected ? palette.focus : palette.line,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.choiceTop}>
        <View
          style={[styles.radio, { borderColor: selected ? palette.focus : palette.textTertiary }]}
        >
          {selected && <View style={[styles.radioDot, { backgroundColor: palette.focus }]} />}
        </View>
        <Text variant="headline">{title}</Text>
      </View>
      <Text variant="footnote" tone="secondary">
        {detail}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 6 },
  summaryAmount: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryText: { flexShrink: 1 },
  choiceGroup: { gap: 10 },
  choices: { flexDirection: "row", gap: 10 },
  choice: { flex: 1, gap: 6, padding: 14, borderRadius: radius.row },
  choiceTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  brandScreen: { backgroundImage: BRAND_SCREEN_GRADIENT },
  display: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  pillStrip: { flexGrow: 0 },
  pills: { flexGrow: 1, justifyContent: "center", gap: 8 },
  pillSymbol: { fontSize: 15 },
  pillNetwork: { opacity: 0.8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: radius.pill,
  },
  pillSelected: { backgroundColor: "#FFFFFF" },
  pillIdle: { backgroundColor: "rgba(255, 255, 255, 0.18)" },
  brandHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    maxWidth: "100%",
  },
  brandHintText: { color: "#FFFFFF", fontWeight: "600", flexShrink: 1 },
});
