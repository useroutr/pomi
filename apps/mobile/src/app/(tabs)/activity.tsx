import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { FilterChips } from "@/components/filter-chips";
import { Illustration } from "@/components/illustration";
import { ListCard } from "@/components/list-card";
import { ReceivedSummary } from "@/components/received-summary";
import { RequestRow } from "@/components/request-row";
import { TabScreen } from "@/components/screen";
import { RowSkeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { type ReceiverRequest, requestsSchema } from "@/lib/api";
import { type Period, periodOf } from "@/lib/format";
import { useApi } from "@/lib/use-api";

type Filter = "all" | "waiting" | "paid" | "closed";

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
];

function matches(request: ReceiverRequest, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "waiting":
      return request.status === "OPEN";
    case "paid":
      return request.status === "PAID" || request.payments.length > 0;
    case "closed":
      return request.status === "CLOSED";
  }
}

// When something last happened to a request: its latest payment, or when
// it was sent.
function lastActivity(request: ReceiverRequest): string {
  return request.payments.at(-1)?.creditedAt ?? request.createdAt;
}

const EMPTY: Record<Filter, string> = {
  all: "Requests you make show up here.",
  waiting: "Nothing is waiting to be paid.",
  paid: "Nothing has been paid yet.",
  closed: "No closed requests.",
};

export default function ActivityScreen() {
  const requests = useApi("/api/requests", requestsSchema);
  const [filter, setFilter] = useState<Filter>("all");
  const list = requests.data?.requests;

  const groups = new Map<Period, ReceiverRequest[]>();
  for (const request of (list ?? [])
    .filter((candidate) => matches(candidate, filter))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))) {
    const period = periodOf(lastActivity(request));
    groups.set(period, [...(groups.get(period) ?? []), request]);
  }

  return (
    <TabScreen refreshing={requests.refreshing} onRefresh={() => void requests.reload()}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Activity
        </Text>
      </View>
      {list !== undefined && list.length > 0 && <ReceivedSummary requests={list} />}

      {list !== undefined && list.length > 0 && (
        <FilterChips
          options={FILTERS.map((option) => ({
            ...option,
            count: list.filter((request) => matches(request, option.value)).length,
          }))}
          value={filter}
          onChange={setFilter}
          label="Show"
        />
      )}

      {list === undefined ? (
        requests.error === null ? (
          <View style={styles.group}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : (
          <Text variant="callout" tone="danger">
            {requests.error}
          </Text>
        )
      ) : groups.size === 0 ? (
        <View style={styles.empty}>
          <Illustration name="coin" size={104} />
          <Text variant="body" tone="secondary" style={styles.emptyText}>
            {EMPTY[filter]}
          </Text>
        </View>
      ) : (
        [...groups.entries()].map(([period, items]) => (
          <View key={period} style={styles.group}>
            <Text variant="label" tone="secondary" accessibilityRole="header" style={styles.period}>
              {period}
            </Text>
            <ListCard>
              {items.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onPress={() => {
                    router.push({ pathname: "/requests/[id]", params: { id: request.id } });
                  }}
                />
              ))}
            </ListCard>
          </View>
        ))
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  group: { gap: 8 },
  period: { marginHorizontal: 4 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 32 },
  emptyText: { textAlign: "center" },
});
