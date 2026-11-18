import { type Href, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { PomiTile } from "@/components/logo";
import { meSchema } from "@/lib/api";
import { useSession } from "@/lib/session";
import { usePalette } from "@/theme/theme";

// Where a launch lands: the welcome for someone signed out, the link step
// for someone who signed in but never claimed a handle, and home otherwise.
export default function LaunchGate() {
  const { state, api, signOut } = useSession();
  const palette = usePalette();
  const [destination, setDestination] = useState<Href | null>(null);

  useEffect(() => {
    if (state.status !== "signed-in") {
      return;
    }
    void api.get("/api/me", meSchema).then(async (result) => {
      if (result.ok) {
        setDestination(result.value.user.handle === null ? "/link" : "/home");
      } else if (result.status === 401) {
        // The session ended on the server (signed out elsewhere, or expired).
        await signOut();
      } else {
        setDestination("/home");
      }
    });
  }, [state.status, api, signOut]);

  if (state.status === "signed-out") {
    return <Redirect href="/welcome" />;
  }
  if (destination !== null) {
    return <Redirect href={destination} />;
  }
  // Looks like the splash it follows, so launch reads as one moment.
  return (
    <View style={[styles.center, { backgroundColor: palette.background }]}>
      <PomiTile size={112} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
