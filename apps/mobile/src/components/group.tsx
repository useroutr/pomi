import { Children, Fragment, type ReactNode } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { haptics } from "@/lib/haptics";
import { radius, usePalette } from "@/theme/theme";
import { Icon, type IconName } from "./icon";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

// A titled card of rows divided by hairlines, the way iOS groups settings.
export function Group({
  title,
  footer,
  withIcons = false,
  children,
}: {
  title?: string;
  footer?: string;
  // Rows lead with icon tiles: dividers then start where the text does.
  withIcons?: boolean;
  children: ReactNode;
}) {
  const palette = usePalette();
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title !== undefined && (
        <Text variant="label" tone="secondary" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      )}
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <View
                style={[
                  styles.divider,
                  withIcons && styles.dividerAfterIcon,
                  { backgroundColor: palette.line },
                ]}
              />
            )}
            {row}
          </Fragment>
        ))}
      </View>
      {footer !== undefined && (
        <Text variant="footnote" tone="secondary" style={styles.title}>
          {footer}
        </Text>
      )}
    </View>
  );
}

export function GroupRow({
  label,
  detail,
  value,
  onPress,
  tone = "primary",
  icon,
  tint,
  leading,
}: {
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  tone?: "primary" | "danger";
  // A white icon on a colored tile, as system settings lead their rows.
  icon?: IconName;
  tint?: string;
  // Anything else 30 points wide in the tile's place, such as a logo.
  leading?: ReactNode;
}) {
  const palette = usePalette();
  const content = (
    <View style={styles.row}>
      {leading}
      {icon !== undefined && (
        <View style={[styles.tile, { backgroundColor: tint ?? palette.primary }]}>
          <Icon name={icon} size={16} color="#FFFFFF" />
        </View>
      )}
      <View style={styles.labels}>
        <Text variant="body" tone={tone} style={tone === "danger" ? styles.strong : undefined}>
          {label}
        </Text>
        {detail !== undefined && (
          <Text variant="footnote" tone="secondary">
            {detail}
          </Text>
        )}
      </View>
      {value !== undefined && (
        <Text variant="callout" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      )}
      {onPress !== undefined && tone === "primary" && (
        <Icon name="chevronRight" size={14} color={palette.textTertiary} />
      )}
    </View>
  );
  return onPress === undefined ? (
    content
  ) : (
    <PressableScale accessibilityRole="button" onPress={onPress} pressedScale={0.985}>
      {content}
    </PressableScale>
  );
}

export function SwitchRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text variant="body">{label}</Text>
        {detail !== undefined && (
          <Text variant="footnote" tone="secondary">
            {detail}
          </Text>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={(next) => {
          haptics.select();
          onChange(next);
        }}
        trackColor={{ true: palette.primary, false: palette.fillPressed }}
        thumbColor={palette.scheme === "dark" && value ? palette.onPrimary : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  title: { marginHorizontal: 4 },
  card: { borderRadius: radius.row, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  dividerAfterIcon: { marginLeft: 58 },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  labels: { flex: 1, gap: 2 },
  value: { maxWidth: "55%" },
  strong: { fontWeight: "600" },
});
