import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Follows the system's Reduce Motion setting, including changes made while
// the app is open.
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      subscription.remove();
    };
  }, []);
  return reduced;
}
