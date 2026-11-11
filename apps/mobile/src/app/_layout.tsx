import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColors } from "@/components/ui";
import { SessionProvider } from "@/lib/session";

// A payment notification shows even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

export default function RootLayout() {
  const colors = useColors();

  // Tapping "You were paid" opens that request.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const requestId: unknown = response.notification.request.content.data?.requestId;
      if (typeof requestId === "string") {
        router.push({ pathname: "/requests/[id]", params: { id: requestId } });
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SessionProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Requests" }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in", headerBackVisible: false }} />
        <Stack.Screen
          name="requests/new"
          options={{ title: "New request", presentation: "modal" }}
        />
        <Stack.Screen name="requests/[id]" options={{ title: "Request" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="scan" options={{ title: "Scan a QR code", presentation: "modal" }} />
        <Stack.Screen name="r/[id]" options={{ title: "" }} />
      </Stack>
      <StatusBar style="auto" />
    </SessionProvider>
  );
}
