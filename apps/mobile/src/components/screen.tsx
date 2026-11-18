import { Children, isValidElement, type ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GUTTER, usePalette } from "@/theme/theme";
import { useDockSpace } from "./dock";
import { Text } from "./text";

// A screen's frame: the theme's background, the safe area, the gutter, and
// a footer pinned above the keyboard for the screen's main button. A
// ScreenHeader among its direct children stays pinned at the top while the
// rest scrolls, so back and close are always one tap away; a hairline
// appears under it once content scrolls beneath.
export function Screen({
  children,
  footer,
  scroll = true,
  topInset = true,
  contentStyle,
  backgroundStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  topInset?: boolean;
  contentStyle?: ViewStyle;
  // Replaces the theme's background, for a screen painted in the brand colors.
  backgroundStyle?: ViewStyle;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);
  const items = Children.toArray(children);
  const header = items.find((item) => isValidElement(item) && item.type === ScreenHeader);
  const body = header === undefined ? items : items.filter((item) => item !== header);
  const topPadding = topInset ? insets.top + 8 : 16;
  const content = [
    styles.content,
    { paddingTop: header === undefined ? topPadding : 8 },
    contentStyle,
  ];
  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: palette.background }, backgroundStyle]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {header !== undefined && (
        <View
          style={[
            styles.pinned,
            { paddingTop: topPadding },
            scrolled && { borderBottomColor: palette.line },
          ]}
        >
          {header}
        </View>
      )}
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => {
            const under = event.nativeEvent.contentOffset.y > 2;
            if (under !== scrolled) {
              setScrolled(under);
            }
          }}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.fill, ...content]}>{body}</View>
      )}
      {footer !== undefined && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// A tab's screen. Its scroll view must be the screen's first child: the
// native tab bar then insets it, and shrinks as it scrolls (iOS 26).
export function TabScreen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const dockSpace = useDockSpace();
  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingTop: Platform.OS === "ios" ? 8 : insets.top + 8, paddingBottom: dockSpace },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.textSecondary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

// The top of a screen: a back or close button, an optional title, and an
// optional action on the right.
export function ScreenHeader({
  leading,
  title,
  trailing,
  titleColor,
}: {
  leading?: ReactNode;
  title?: string;
  trailing?: ReactNode;
  titleColor?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>{leading}</View>
      {title !== undefined && (
        <Text
          variant="headline"
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, titleColor !== undefined && { color: titleColor }]}
        >
          {title}
        </Text>
      )}
      <View style={[styles.side, styles.trailing, title === undefined && styles.stretch]}>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pinned: {
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  content: { flexGrow: 1, paddingHorizontal: GUTTER, paddingBottom: 24, gap: 20 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, gap: 4 },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  side: { minWidth: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  trailing: { justifyContent: "flex-end" },
  stretch: { flex: 1 },
  title: { flex: 1, textAlign: "center" },
});
