import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button, IconButton } from "@/components/button";
import { Icon } from "@/components/icon";
import { Illustration } from "@/components/illustration";
import { ListCard } from "@/components/list-card";
import { PageCard } from "@/components/page-card";
import { PayWithStrip } from "@/components/pay-with-strip";
import { PaymentRow, receivedPayments } from "@/components/payment-row";
import { PressableScale } from "@/components/pressable-scale";
import { RequestRow } from "@/components/request-row";
import { TabScreen } from "@/components/screen";
import { RowSkeleton, Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { assetsSchema, meSchema, payoutAddressesSchema, requestsSchema } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { radius, usePalette } from "@/theme/theme";

export default function HomeScreen() {
  const me = useApi("/api/me", meSchema);
  const payout = useApi("/api/me/payout-addresses", payoutAddressesSchema);
  const requests = useApi("/api/requests", requestsSchema);
  const assets = useApi("/api/assets", assetsSchema);

  const user = me.data?.user;
  const firstName = user?.displayName?.split(" ")[0];
  const list = requests.data?.requests;
  const waiting = (list ?? []).filter((request) => request.status === "OPEN").slice(0, 3);
  const paid = receivedPayments(list ?? []).slice(0, 3);

  return (
    <TabScreen
      refreshing={requests.refreshing}
      onRefresh={() => {
        void me.reload();
        void payout.reload();
        void requests.reload();
      }}
    >
      <View style={styles.header}>
        {user === undefined ? (
          <Skeleton style={styles.titleSkeleton} />
        ) : (
          <Text variant="title" accessibilityRole="header">
            {firstName === undefined ? "Hello" : `Hi, ${firstName}`}
          </Text>
        )}
        <IconButton
          icon="scan"
          label="Scan a Pomi link"
          onPress={() => {
            router.push({ pathname: "/scan", params: { for: "link" } });
          }}
        />
      </View>

      {payout.data !== null && payout.data.payoutAddresses.length === 0 && <SetupNotice />}

      {user?.handle !== null && user?.handle !== undefined && <PageCard handle={user.handle} />}

      {assets.data !== null && <PayWithStrip payWith={assets.data.payWith} />}

      {requests.error !== null && list === undefined ? (
        <Text variant="callout" tone="danger">
          {requests.error}
        </Text>
      ) : list === undefined ? (
        <View style={styles.section}>
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : list.length === 0 ? (
        <FirstRequest />
      ) : (
        <>
          {waiting.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title="Waiting"
                onSeeAll={() => {
                  router.navigate("/activity");
                }}
              />
              <ListCard>
                {waiting.map((request) => (
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
          )}
          {paid.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title="Recently paid" />
              <ListCard>
                {paid.map((payment) => (
                  <PaymentRow
                    key={`${payment.request.id}:${payment.creditedAt}`}
                    payment={payment}
                    onPress={() => {
                      router.push({
                        pathname: "/requests/[id]",
                        params: { id: payment.request.id },
                      });
                    }}
                  />
                ))}
              </ListCard>
            </View>
          )}
        </>
      )}
    </TabScreen>
  );
}

function SectionTitle({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="section" accessibilityRole="header">
        {title}
      </Text>
      {onSeeAll !== undefined && (
        <Button title="See all" variant="plain" size="small" onPress={onSeeAll} />
      )}
    </View>
  );
}

// The first run: one thing to do, said plainly.
function FirstRequest() {
  return (
    <View style={styles.empty}>
      <Illustration name="moneyBag" size={132} />
      <View style={styles.emptyWords}>
        <Text variant="title2" accessibilityRole="header" style={styles.center}>
          Ask for your first payment
        </Text>
        <Text variant="body" tone="secondary" style={styles.center}>
          Pick an amount and share the link. They pay from any wallet, on any of the networks above.
        </Text>
      </View>
      <Button
        title="Ask for money"
        icon="plus"
        onPress={() => {
          router.push("/ask");
        }}
      />
    </View>
  );
}

function SetupNotice() {
  const palette = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityHint="Opens the step to add your wallet address"
      onPress={() => {
        router.push("/payout");
      }}
      style={[styles.notice, { backgroundColor: palette.notice.background }]}
    >
      <View style={[styles.noticeIcon, { backgroundColor: palette.surface }]}>
        <Icon name="wallet" size={18} color={palette.notice.foreground} />
      </View>
      <View style={styles.noticeWords}>
        <Text variant="headline" style={{ color: palette.notice.foreground }}>
          Add where money lands
        </Text>
        <Text variant="footnote" style={{ color: palette.notice.foreground }}>
          Needed before anyone can pay you.
        </Text>
      </View>
      <Icon name="chevronRight" size={14} color={palette.notice.foreground} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  titleSkeleton: { width: 160, height: 34 },
  section: { gap: 10 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: -10,
  },
  empty: { alignItems: "center", gap: 22, paddingVertical: 28 },
  emptyWords: { gap: 8, alignItems: "center" },
  center: { textAlign: "center" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.row,
  },
  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeWords: { flex: 1, gap: 2 },
});
