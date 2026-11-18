import { networkName } from "@pomi/shared";
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton } from "@/components/button";
import { PomiTile } from "@/components/logo";
import { Text } from "@/components/text";
import { addressFormat } from "@/lib/address-format";
import { APP_URL } from "@/lib/config";
import { haptics } from "@/lib/haptics";
import { radius, usePalette } from "@/theme/theme";

// Scans either a payout address on one network, or a Pomi link, which opens
// the pay page in the in-app browser.
export default function ScanScreen() {
  const params = useLocalSearchParams<{ for?: string; onboarding?: string; network?: string }>();
  const network = params.network ?? "stellar";
  const purpose = params.for === "address" ? "address" : "link";
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  // The camera reports the same code many times a second while it stays in
  // view, so a refused code is warned about once, not on every frame.
  const refused = useRef<string | null>(null);

  function refuse(data: string, message: string) {
    if (refused.current === data) {
      return;
    }
    refused.current = data;
    haptics.warning();
    setError(message);
  }

  function onScanned({ data }: BarcodeScanningResult) {
    if (handled.current) {
      return;
    }
    if (purpose === "address") {
      const address = addressFormat(network).find(data);
      if (address === null) {
        refuse(data, `That code isn't a ${networkName(network)} address.`);
        return;
      }
      handled.current = true;
      haptics.success();
      router.dismissTo({
        pathname: "/payout",
        params: { address, network, onboarding: params.onboarding ?? "0" },
      });
      return;
    }
    if (data.startsWith(`${APP_URL}/`)) {
      handled.current = true;
      haptics.success();
      void WebBrowser.openBrowserAsync(data).then(() => {
        router.back();
      });
      return;
    }
    refuse(data, "That code isn't a Pomi link.");
  }

  const close = (
    <IconButton
      icon="close"
      label="Close"
      tone="onDark"
      onPress={() => {
        router.back();
      }}
    />
  );

  if (permission === null) {
    return <View style={[styles.fill, { backgroundColor: "#0F0D12" }]} />;
  }
  if (!permission.granted) {
    // Once the camera is refused, the system will not ask again: only the
    // Settings app can turn it back on.
    return (
      <View
        style={[
          styles.fill,
          styles.ask,
          { backgroundColor: palette.background, paddingTop: insets.top + 8 },
        ]}
      >
        <View style={styles.askClose}>
          <IconButton
            icon="close"
            label="Close"
            onPress={() => {
              router.back();
            }}
          />
        </View>
        <View style={styles.askBody}>
          <PomiTile size={80} />
          <Text variant="title2" style={styles.center}>
            {purpose === "address" ? "Scan your wallet's QR code" : "Scan a Pomi link"}
          </Text>
          <Text variant="body" tone="secondary" style={styles.center}>
            Pomi uses the camera only to read the code, and keeps no pictures.
          </Text>
        </View>
        <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {permission.canAskAgain ? (
            <Button title="Allow the camera" onPress={() => void requestPermission()} />
          ) : (
            <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
          )}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.fill, { backgroundColor: "#000000" }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />
      <View
        style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.topBar}>{close}</View>
        <View style={styles.frame} />
        <View style={styles.caption}>
          <Text variant="headline" style={styles.light}>
            {purpose === "address"
              ? "Point at your wallet's receive code"
              : "Point at a Pomi QR code"}
          </Text>
          {error !== null && (
            <Text variant="callout" style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  ask: { paddingHorizontal: 20 },
  askClose: { alignItems: "flex-start" },
  askBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  center: { textAlign: "center" },
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBar: { alignSelf: "stretch", alignItems: "flex-start" },
  frame: {
    width: 260,
    height: 260,
    borderRadius: radius.sheet,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
  },
  caption: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.row,
    backgroundColor: "rgba(15,13,18,0.6)",
  },
  light: { color: "#FFFFFF" },
  errorText: { color: "#FFB4A6", textAlign: "center" },
});
