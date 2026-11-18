import { router } from "expo-router";
import { type TabTriggerSlotProps } from "expo-router/ui";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";
import { BRAND_VIOLET } from "@/theme/palette";
import { usePalette } from "@/theme/theme";
import { Icon, type IconName } from "./icon";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

const DOCK_HEIGHT = 64;
const DOCK_GAP_BELOW = 10;

// How much of a tab screen the dock covers, so the last row can scroll clear
// of it.
export function useDockSpace(): number {
  const insets = useSafeAreaInsets();
  return DOCK_HEIGHT + Math.max(insets.bottom, 12) + DOCK_GAP_BELOW + 16;
}

// The bottom bar: the tabs in a floating capsule, the current one opened into
// a dark pill with its name, and asking for money as its own round button
// beside them, one tap away from every tab, as payment apps put their main
// action in the bar.
export function Dock({ children, style, ...props }: ViewProps & { children?: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const dockSpace = useDockSpace();
  return (
    <>
      {/* Rows scrolling under the dock fade into the page instead of
          showing through behind it. */}
      <View
        pointerEvents="none"
        style={[
          styles.fade,
          {
            height: dockSpace,
            backgroundImage: `linear-gradient(180deg, ${transparent(palette.background)} 0%, ${palette.background} 55%)`,
          },
        ]}
      />
      <View
        {...props}
        pointerEvents="box-none"
        style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + DOCK_GAP_BELOW }, style]}
      >
        <View
          accessibilityRole="tablist"
          style={[styles.capsule, { backgroundColor: palette.surface, borderColor: palette.line }]}
        >
          {children}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Ask for money"
          onPress={() => {
            haptics.tap();
            router.push("/ask");
          }}
          style={styles.ask}
        >
          <Icon name="plus" size={26} color="#FFFFFF" weight="bold" />
        </PressableScale>
      </View>
    </>
  );
}

// "#F6F4F9" as fully transparent, so a fade ends in the page's own color
// rather than in grey.
function transparent(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${String(value >> 16)}, ${String((value >> 8) & 255)}, ${String(value & 255)}, 0)`;
}

// One tab. Expo Router's TabTrigger passes `isFocused` and the press handler.
export function DockTab({
  icon,
  label,
  isFocused = false,
  ...props
}: Omit<TabTriggerSlotProps, "ref"> & { icon: IconName; label: string }) {
  const palette = usePalette();
  const color = isFocused ? palette.background : palette.textSecondary;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      onPressIn={() => {
        if (!isFocused) {
          haptics.select();
        }
      }}
      style={[
        styles.tab,
        isFocused ? [styles.tabFocused, { backgroundColor: palette.text }] : styles.tabIdle,
      ]}
    >
      <Icon name={icon} size={20} color={color} />
      {isFocused && (
        <Text variant="headline" numberOfLines={1} style={[styles.tabLabel, { color }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  wrap: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  capsule: {
    flex: 1,
    height: DOCK_HEIGHT,
    borderRadius: DOCK_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    boxShadow: "0 12px 32px -12px rgba(21, 18, 28, 0.28), 0 2px 6px rgba(21, 18, 28, 0.06)",
  },
  tab: {
    height: DOCK_HEIGHT - 12,
    borderRadius: (DOCK_HEIGHT - 12) / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabFocused: { flex: 1, paddingHorizontal: 16 },
  tabIdle: { width: 56 },
  tabLabel: { fontSize: 15, flexShrink: 1 },
  ask: {
    width: DOCK_HEIGHT,
    height: DOCK_HEIGHT,
    borderRadius: DOCK_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_VIOLET,
    boxShadow: "0 12px 28px -10px rgba(106, 61, 245, 0.7)",
  },
});
