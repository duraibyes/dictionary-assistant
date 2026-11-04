// Server address and app secret. Defaults come from build-time env (EXPO_PUBLIC_*);
// they can be changed inside the app (Settings) and are stored securely on the phone.
import * as SecureStore from "expo-secure-store";

export interface Settings {
  apiUrl: string;
  appSecret: string;
  /** Ask the AI automatically when the offline dictionary has gaps (uses API calls). */
  autoAi: boolean;
}

const KEY = "settings.v1";
const DEVICE_KEY = "device.id";

export const defaults: Settings = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || "https://dictionary-ivory-one.vercel.app").replace(/\/+$/, ""),
  appSecret: process.env.EXPO_PUBLIC_APP_SECRET ?? "",
  autoAi: true,
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // fall back to defaults
  }
  return defaults;
}

export async function saveSettings(s: Settings): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify({ ...s, apiUrl: s.apiUrl.trim().replace(/\/+$/, "") }));
}

let deviceId: string | null = null;
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  try {
    deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
    if (!deviceId) {
      deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
    }
  } catch {
    deviceId = "unknown";
  }
  return deviceId;
}
