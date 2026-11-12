import { parseStellarAccount } from "@pomi/shared";
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Body, Button, ErrorText, styles } from "@/components/ui";
import { APP_URL } from "@/lib/config";

// Scans either a Stellar address, for the payout address, or a Pomi link,
// which opens the pay page in the in-app browser.
export default function ScanScreen() {
  const purpose = useLocalSearchParams<{ for?: string }>().for === "address" ? "address" : "link";
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  function onScanned({ data }: BarcodeScanningResult) {
    if (handled.current) {
      return;
    }
    const text = data.replace(/^web\+stellar:pay\?destination=/i, "").split("&")[0] ?? "";
    if (purpose === "address") {
      try {
        const address = parseStellarAccount(text);
        handled.current = true;
        router.dismissTo({ pathname: "/settings", params: { address } });
      } catch {
        setError("That code is not a Stellar account address.");
      }
      return;
    }
    if (data.startsWith(`${APP_URL}/`)) {
      handled.current = true;
      void WebBrowser.openBrowserAsync(data).then(() => {
        router.back();
      });
      return;
    }
    setError("That code is not a Pomi link.");
  }

  if (permission === null) {
    return <View style={styles.screen} />;
  }
  if (!permission.granted) {
    // Once the camera is refused, the system will not ask again: only the
    // Settings app can turn it back on.
    return (
      <View style={styles.screen}>
        <Body>Pomi needs the camera to scan a QR code.</Body>
        {permission.canAskAgain ? (
          <Button title="Allow the camera" onPress={() => void requestPermission()} />
        ) : (
          <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />
      <View style={[styles.screen, { flexGrow: 0, marginTop: "auto" }]}>
        <ErrorText message={error} />
      </View>
    </View>
  );
}
