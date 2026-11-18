import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { type ApiClient } from "./api";

const PUSH_TOKEN_KEY = "pomi.push-token";

// Expo push tokens belong to an EAS project and only exist on a real
// device. Until the project id is set (eas init), and in a simulator, the
// app simply asks for no token and payments still arrive by email.
function easProjectId(): string | undefined {
  const fromAppConfig: unknown = Constants.expoConfig?.extra?.eas;
  const fromBuild: unknown = Constants.easConfig;
  return projectIdOf(fromAppConfig) ?? projectIdOf(fromBuild);
}

function projectIdOf(config: unknown): string | undefined {
  if (typeof config === "object" && config !== null && "projectId" in config) {
    return typeof config.projectId === "string" ? config.projectId : undefined;
  }
  return undefined;
}

export type NotificationPermission = "granted" | "undetermined" | "denied";

export async function notificationPermission(): Promise<NotificationPermission> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) {
    return "granted";
  }
  return permission.canAskAgain ? "undetermined" : "denied";
}

// Asks the system only when the receiver chose to turn notifications on
// (after their first request, or in You), never at launch: Apple's guidance,
// and a prompt that means something gets a yes more often.
export async function enableNotifications(api: ApiClient): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (granted) {
    await registerDevice(api);
  }
  return granted;
}

// After sign-in or at launch: registers this phone only if the receiver
// already allowed notifications, so no prompt appears unasked.
export async function registerIfAllowed(api: ApiClient): Promise<void> {
  if ((await Notifications.getPermissionsAsync()).granted) {
    await registerDevice(api);
  }
}

async function registerDevice(api: ApiClient): Promise<void> {
  const projectId = easProjectId();
  if (!Device.isDevice || projectId === undefined) {
    return;
  }
  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  const registered = await api.postNoContent("/api/devices", {
    pushToken,
    platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
  });
  if (registered.ok) {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
  }
}

// So the next person to sign in on this phone is not told of this
// receiver's payments.
export async function forgetPushDevice(api: ApiClient): Promise<void> {
  const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (pushToken !== null) {
    await api.delete("/api/devices", { pushToken });
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}
