import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { FilterChips } from "@/components/filter-chips";
import { Illustration } from "@/components/illustration";
import { ListCard } from "@/components/list-card";
import { PaymentRow } from "@/components/payment-row";
import { ReceivedSummary } from "@/components/received-summary";
import { RequestRow } from "@/components/request-row";
import { TabScreen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { RowSkeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import {
  type ReceivedPayment,
  receivedActivitySchema,
  type ReceiverRequest,
  requestsSchema,
} from "@/lib/api";
import { type Period, periodOf } from "@/lib/format";
import { useApi } from "@/lib/use-api";

// Activity shows either every payment that arrived, the pay box's included,
// or the requests the receiver made.
type Shown = "payments" | "requests";

const SHOWN: readonly { value: Shown; label: string }[] = [
  { value: "payments", label: "Payments" },
  { value: "requests", label: "Requests" },
];

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

function byPeriod<T>(items: T[], when: (item: T) => string): Map<Period, T[]> {
  const groups = new Map<Period, T[]>();
  for (const item of items) {
    const period = periodOf(when(item));
    groups.set(period, [...(groups.get(period) ?? []), item]);
  }
  return groups;
}

const EMPTY: Record<Filter, string> = {
  all: "Requests you make show up here.",
  waiting: "Nothing is waiting to be paid.",
  paid: "Nothing has been paid yet.",
  closed: "No closed requests.",
};

export default function ActivityScreen() {
  const requests = useApi("/api/requests", requestsSchema);
  const activity = useApi("/api/me/payments", receivedActivitySchema);
  const [shown, setShown] = useState<Shown>("payments");
  const [filter, setFilter] = useState<Filter>("all");
  const list = requests.data?.requests;
  const received = activity.data;

  return (
    <TabScreen
      refreshing={requests.refreshing || activity.refreshing}
      onRefresh={() => {
        void requests.reload();
        void activity.reload();
      }}
    >
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Activity
        </Text>
      </View>
      {received !== null && <ReceivedSummary activity={received} />}
      <Segmented options={SHOWN} value={shown} onChange={setShown} label="Show" stretch />

      {shown === "payments" ? (
        <Payments
          payments={received?.recent}
          error={activity.error}
          onOpen={(payment) => {
            router.push({
              pathname: "/paid/[id]",
              params: { id: payment.requestId, payment: payment.id },
            });
          }}
        />
      ) : (
        <>
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
            <Loading error={requests.error} />
          ) : (
            <Groups
              groups={byPeriod(
                list
                  .filter((candidate) => matches(candidate, filter))
                  .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))),
                lastActivity,
              )}
              empty={EMPTY[filter]}
              render={(request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onPress={() => {
                    router.push({ pathname: "/requests/[id]", params: { id: request.id } });
                  }}
                />
              )}
            />
          )}
        </>
      )}
    </TabScreen>
  );
}

function Payments({
  payments,
  error,
  onOpen,
}: {
  payments: ReceivedPayment[] | undefined;
  error: string | null;
  onOpen: (payment: ReceivedPayment) => void;
}) {
  if (payments === undefined) {
    return <Loading error={error} />;
  }
  return (
    <Groups
      // The server lists them newest first.
      groups={byPeriod(payments, (payment) => payment.creditedAt)}
      empty="Payments to your requests and your pay box show up here."
      render={(payment) => (
        <PaymentRow
          key={payment.id}
          payment={payment}
          onPress={() => {
            onOpen(payment);
          }}
        />
      )}
    />
  );
}

function Loading({ error }: { error: string | null }) {
  if (error !== null) {
    return (
      <Text variant="callout" tone="danger">
        {error}
      </Text>
    );
  }
  return (
    <View style={styles.group}>
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </View>
  );
}

function Groups<T>({
  groups,
  empty,
  render,
}: {
  groups: Map<Period, T[]>;
  empty: string;
  render: (item: T) => ReactNode;
}) {
  if (groups.size === 0) {
    return (
      <View style={styles.empty}>
        <Illustration name="coin" size={104} />
        <Text variant="body" tone="secondary" style={styles.emptyText}>
          {empty}
        </Text>
      </View>
    );
  }
  return [...groups.entries()].map(([period, items]) => (
    <View key={period} style={styles.group}>
      <Text variant="label" tone="secondary" accessibilityRole="header" style={styles.period}>
        {period}
      </Text>
      <ListCard>{items.map(render)}</ListCard>
    </View>
  ));
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
