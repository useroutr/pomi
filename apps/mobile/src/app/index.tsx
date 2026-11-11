import { Redirect, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Body, Button, Card, ErrorText, styles, useColors } from "@/components/ui";
import { type ReceiverRequest, requestsSchema } from "@/lib/api";
import { useSession } from "@/lib/session";

const STATUS_LABELS = { OPEN: "Waiting", PAID: "Paid", CLOSED: "Closed" } as const;

export default function RequestsScreen() {
  const { state, api } = useSession();
  const colors = useColors();
  const [requests, setRequests] = useState<ReceiverRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await api.get("/api/requests", requestsSchema);
    if (result.ok) {
      setRequests(result.value.requests);
      setError(null);
    } else {
      setError(result.message);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      if (state.status === "signed-in") {
        void load();
      }
    }, [state.status, load]),
  );

  if (state.status === "loading") {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }
  if (state.status === "signed-out") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  router.push({ pathname: "/scan", params: { for: "link" } });
                }}
              >
                <Text style={{ color: colors.foreground, fontSize: 16 }}>Scan</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  router.push("/settings");
                }}
              >
                <Text style={{ color: colors.foreground, fontSize: 16 }}>Settings</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={styles.screen}
        data={requests ?? []}
        keyExtractor={(request) => request.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => {
                setRefreshing(false);
              });
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Button
              title="New request"
              onPress={() => {
                router.push("/requests/new");
              }}
            />
            <ErrorText message={error} />
          </View>
        }
        ListEmptyComponent={
          requests === null ? <ActivityIndicator /> : <Body muted>No requests yet.</Body>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.push({ pathname: "/requests/[id]", params: { id: item.id } });
            }}
          >
            <Card>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "600" }}>
                  {item.amount ?? "Any amount of"} {item.assetSymbol}
                </Text>
                <Text
                  style={{
                    color: item.status === "PAID" ? colors.success : colors.muted,
                    fontWeight: "600",
                  }}
                >
                  {item.kind === "REUSABLE" && item.payments.length > 0
                    ? `Paid ${String(item.payments.length)}x`
                    : STATUS_LABELS[item.status]}
                </Text>
              </View>
              {item.note !== null && <Body>{item.note}</Body>}
            </Card>
          </Pressable>
        )}
      />
    </>
  );
}
