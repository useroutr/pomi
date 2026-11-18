import { type ReactNode, useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { radius, usePalette } from "@/theme/theme";
import { Text } from "./text";

// A filled field: no outline until it has focus, then an ink border. A
// prefix sits inside it (pomi.app/) and an accessory at its end (Paste).
export function Field({
  label,
  hint,
  error,
  prefix,
  accessory,
  multiline,
  ...props
}: TextInputProps & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  prefix?: string;
  accessory?: ReactNode;
}) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error !== null;
  return (
    <View style={styles.field}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View
        style={[
          styles.box,
          multiline === true && styles.multilineBox,
          {
            backgroundColor: focused ? palette.surface : palette.fill,
            borderColor: hasError ? palette.danger : focused ? palette.focus : "transparent",
          },
        ]}
      >
        {prefix !== undefined && (
          <Text variant="body" tone="secondary">
            {prefix}
          </Text>
        )}
        <TextInput
          placeholderTextColor={palette.textTertiary}
          selectionColor={palette.coral}
          accessibilityLabel={label}
          multiline={multiline}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline === true && styles.multilineInput,
            { color: palette.text },
            props.style,
          ]}
        />
        {accessory}
      </View>
      {hasError ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : typeof hint === "string" ? (
        <Text variant="footnote" tone="secondary">
          {hint}
        </Text>
      ) : (
        hint
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  box: {
    minHeight: 56,
    borderRadius: radius.field,
    borderWidth: 2,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  multilineBox: { alignItems: "flex-start", paddingVertical: 12 },
  input: { flex: 1, fontSize: 17, minHeight: 52, paddingVertical: 0 },
  multilineInput: { minHeight: 52, lineHeight: 24, textAlignVertical: "top" },
});
