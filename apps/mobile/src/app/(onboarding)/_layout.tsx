import { Stack } from "expo-router";
import { usePalette } from "@/theme/theme";

export default function OnboardingLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}
    />
  );
}
