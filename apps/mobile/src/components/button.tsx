import { ActivityIndicator, StyleSheet, View, type ViewStyle } from "react-native";
import { haptics } from "@/lib/haptics";
import { BRAND_VIOLET } from "@/theme/palette";
import { radius } from "@/theme/theme";
import { usePalette } from "@/theme/theme";
import { Icon, type IconName } from "./icon";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

// "inverse" is the white button on a screen painted in the brand colors,
// "ghost" the plain one beside it, and "glass" a frosted one for a second
// action on a vibrant card.
type Variant = "primary" | "secondary" | "plain" | "destructive" | "inverse" | "ghost" | "glass";
type Size = "large" | "medium" | "small";

const HEIGHTS: Record<Size, number> = { large: 56, medium: 44, small: 36 };

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "large",
  icon,
  pending = false,
  disabled = false,
  accessibilityLabel,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  pending?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const palette = usePalette();
  const inactive = pending || disabled;
  const background =
    variant === "primary"
      ? palette.primary
      : variant === "secondary"
        ? palette.fill
        : variant === "inverse"
          ? "#FFFFFF"
          : variant === "glass"
            ? "rgba(255, 255, 255, 0.16)"
            : "transparent";
  const foreground =
    variant === "primary"
      ? palette.onPrimary
      : variant === "destructive"
        ? palette.danger
        : variant === "inverse"
          ? BRAND_VIOLET
          : variant === "ghost" || variant === "glass"
            ? "#FFFFFF"
            : palette.text;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: pending }}
      disabled={inactive}
      onPress={() => {
        if (variant === "primary" || variant === "inverse") {
          haptics.tap();
        }
        onPress();
      }}
      style={[
        styles.button,
        {
          height: HEIGHTS[size],
          paddingHorizontal: size === "small" ? 14 : 20,
          backgroundColor: background,
          opacity: disabled && !pending ? 0.4 : 1,
        },
        variant === "glass" && styles.glass,
        style,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon !== undefined && (
            <Icon name={icon} size={size === "small" ? 15 : 18} color={foreground} />
          )}
          <Text
            variant={size === "small" ? "label" : "headline"}
            numberOfLines={1}
            style={{
              color: foreground,
              fontSize: size === "small" ? 14 : size === "medium" ? 16 : 17,
            }}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

// A round button that only shows an icon, such as back or close.
export function IconButton({
  icon,
  label,
  onPress,
  size = 44,
  tone = "fill",
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  tone?: "fill" | "surface" | "onDark";
}) {
  const palette = usePalette();
  const background =
    tone === "fill"
      ? palette.fill
      : tone === "surface"
        ? palette.surface
        : "rgba(255,255,255,0.14)";
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      pressedScale={0.92}
      style={[styles.iconButton, { width: size, height: size, backgroundColor: background }]}
    >
      <Icon
        name={icon}
        size={Math.round(size * 0.4)}
        color={tone === "onDark" ? "#FFFFFF" : palette.text}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  glass: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255, 255, 255, 0.45)" },
  button: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
