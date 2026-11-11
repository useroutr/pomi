import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useColorScheme,
  View,
} from "react-native";

export function useColors() {
  const dark = useColorScheme() === "dark";
  return {
    background: dark ? "#0d0d0d" : "#ffffff",
    foreground: dark ? "#f2f2f2" : "#111111",
    muted: dark ? "#a6a6a6" : "#555555",
    border: dark ? "#2a2a2a" : "#e3e3e3",
    subtle: dark ? "#1a1a1a" : "#f4f4f4",
    error: "#c62828",
    success: dark ? "#8fd6a4" : "#1e6b34",
    warning: dark ? "#f2d27a" : "#6b4e00",
    warningBackground: dark ? "#332700" : "#fff4d6",
  };
}

export function Title({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.title, { color: colors.foreground }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[styles.body, { color: muted === true ? colors.muted : colors.foreground }]}>
      {children}
    </Text>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const colors = useColors();
  return message === null ? null : (
    <Text style={[styles.body, { color: colors.error }]}>{message}</Text>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={[styles.card, { borderColor: colors.border }]}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.muted, color: colors.foreground }]}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  pending,
  secondary,
  disabled,
}: {
  title: string;
  onPress: () => void;
  pending?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const inactive = pending === true || disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        secondary === true
          ? { borderWidth: 1, borderColor: colors.border }
          : { backgroundColor: colors.foreground },
        inactive && styles.inactive,
      ]}
    >
      {pending === true ? (
        <ActivityIndicator color={secondary === true ? colors.foreground : colors.background} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: secondary === true ? colors.foreground : colors.background },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  inactive: { opacity: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
