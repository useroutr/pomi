import { Redirect } from "expo-router";
import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";
import { Dock, DockTab } from "@/components/dock";
import { useSession } from "@/lib/session";

// Pomi's own bottom bar rather than the system's: three tabs in a floating
// capsule and the ask button beside them (components/dock.tsx).
export default function TabsLayout() {
  const { state } = useSession();
  // Signing out, or a session the server ended, leads back to the welcome.
  if (state.status === "signed-out") {
    return <Redirect href="/welcome" />;
  }
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <Dock>
          <TabTrigger name="home" href="/home" asChild>
            <DockTab icon="home" label="Home" />
          </TabTrigger>
          <TabTrigger name="activity" href="/activity" asChild>
            <DockTab icon="activity" label="Activity" />
          </TabTrigger>
          <TabTrigger name="you" href="/you" asChild>
            <DockTab icon="you" label="You" />
          </TabTrigger>
        </Dock>
      </TabList>
    </Tabs>
  );
}
