import * as Haptics from "expo-haptics";

// One meaning per pattern, used the same way everywhere (Apple's guidance):
// a tap on a main action, a tick when a choice changes, success when money
// is asked for or arrives, and a warning when something is refused.
export const haptics = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  select: () => void Haptics.selectionAsync(),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
