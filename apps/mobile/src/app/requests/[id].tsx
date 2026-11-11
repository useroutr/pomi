import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { QrCode } from "@/components/qr-code";
import { Body, Button, Card, ErrorText, styles, Title, useColors } from "@/components/ui";
import { type ReceiverRequest, requestsSchema } from "@/lib/api";
import { requestLink } from "@/lib/config";
import { useSession } from "@/lib/session";

const STATUS_LABELS = { OPEN: "Waiting for payment", PAID: "Paid", CLOSED: "Closed" } as const;

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [request, setRequest] = useState<ReceiverRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const result = await api.get("/api/requests", requestsSchema);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const found = result.value.requests.find((candidate) => candidate.id === id);
    if (found === undefined) {
      setError("This request is not one of yours.");
    } else {
      setRequest(found);
    }
  }, [api, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (request === null) {
    return error === null ? (
      <ActivityIndicator style={{ flex: 1 }} />
    ) : (
      <View style={styles.screen}>
        <ErrorText message={error} />
      </View>
    );
  }

  const link = requestLink(request.id);
  const paidCount = request.payments.length;

  async function close() {
    setPending(true);
    const result = await api.postNoContent(`/api/requests/${encodeURIComponent(id)}/close`, {});
    setPending(false);
    if (result.ok) {
      await load();
    } else {
      setError(result.message);
    }
  }

  async function toggleListed(current: ReceiverRequest) {
    setPending(true);
    const result = await api.patch(`/api/requests/${encodeURIComponent(id)}`, {
      listed: !current.listed,
    });
    setPending(false);
    if (result.ok) {
      await load();
    } else {
      setError(result.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Title>
        {request.amount ?? "Any amount of"} {request.assetSymbol}
      </Title>
      {request.note !== null && <Body>{request.note}</Body>}
      <Text
        style={{
          color: request.status === "PAID" ? colors.success : colors.muted,
          fontWeight: "600",
        }}
      >
        {STATUS_LABELS[request.status]}
        {request.kind === "REUSABLE" &&
          `, paid ${String(paidCount)} ${paidCount === 1 ? "time" : "times"}`}
      </Text>

      {request.status === "OPEN" && (
        <Card>
          <QrCode value={link} size={Math.min(width - 64, 280)} />
          <Body muted>Anyone who scans this or opens the link can pay.</Body>
          <View style={styles.row}>
            <Button title="Share" onPress={() => void Share.share({ message: link, url: link })} />
            <Button
              title={copied ? "Copied" : "Copy link"}
              secondary
              onPress={() =>
                void Clipboard.setStringAsync(link).then(() => {
                  setCopied(true);
                })
              }
            />
            <Button
              title="Open pay page"
              secondary
              onPress={() => void WebBrowser.openBrowserAsync(link)}
            />
          </View>
        </Card>
      )}

      {request.payments.map((payment) => (
        <Card key={payment.creditedAt}>
          <Body>
            Paid {payment.amount} {request.assetSymbol}
          </Body>
          <Body muted>{new Date(payment.creditedAt).toLocaleString()}</Body>
        </Card>
      ))}

      <ErrorText message={error} />
      {request.status === "OPEN" && (
        <View style={styles.row}>
          <Button
            title={request.listed ? "Hide from my page" : "Show on my page"}
            secondary
            pending={pending}
            onPress={() => void toggleListed(request)}
          />
          <Button title="Close request" secondary pending={pending} onPress={() => void close()} />
        </View>
      )}
      <Button
        title="Back to requests"
        secondary
        onPress={() => {
          router.navigate("/");
        }}
      />
    </ScrollView>
  );
}
