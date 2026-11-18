import { BricolageGrotesque_500Medium } from "@expo-google-fonts/bricolage-grotesque/500Medium";
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SessionProvider } from "@/lib/session";
import { usePalette } from "@/theme/theme";

// The splash stays up until the display font is ready, so no screen ever
// draws in a fallback font first.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

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
  const palette = usePalette();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError !== null) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Tapping "You were paid" opens the moment itself.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const requestId: unknown = response.notification.request.content.data?.requestId;
      if (typeof requestId === "string") {
        router.push({ pathname: "/paid/[id]", params: { id: requestId } });
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded && fontError === null) {
    return null;
  }

  // Navigation draws its own backgrounds; giving it the palette avoids a
  // white flash between screens in the dark theme.
  const base = palette.scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.text,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.line,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="index" options={{ animation: "fade" }} />
          <Stack.Screen name="(onboarding)" options={{ animation: "fade" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="ask" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="paid/[id]"
            options={{ presentation: "fullScreenModal", animation: "fade" }}
          />
          <Stack.Screen name="scan" options={{ presentation: "fullScreenModal" }} />
          <Stack.Screen name="page-qr" options={{ presentation: "modal" }} />
          <Stack.Screen name="pay-with" options={{ presentation: "modal" }} />
        </Stack>
        <StatusBar style={palette.scheme === "dark" ? "light" : "dark"} />
      </SessionProvider>
    </ThemeProvider>
  );
}
