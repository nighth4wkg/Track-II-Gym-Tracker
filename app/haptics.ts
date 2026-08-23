import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export function haptic(pattern: number | number[] = 12) {
  if (!globalThis.window) return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics")) {
      const operation =
        Array.isArray(pattern) && pattern[0] >= 100
          ? Haptics.notification({ type: NotificationType.Success })
          : Haptics.impact({ style: Array.isArray(pattern) || pattern >= 14 ? ImpactStyle.Medium : ImpactStyle.Light });
      void operation.catch(() => undefined);
      return;
    }
    globalThis.navigator?.vibrate?.(pattern);
  } catch {
    /* haptics are optional on unsupported browsers */
  }
}

export function hapticSelectionStart() {
  if (!globalThis.window) return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics")) {
      void Haptics.selectionStart().catch(() => undefined);
      return;
    }
    haptic(6);
  } catch {
    /* haptics are optional on unsupported browsers */
  }
}

export function hapticSelectionChanged() {
  if (!globalThis.window) return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics")) {
      void Haptics.selectionChanged().catch(() => undefined);
      return;
    }
    haptic(5);
  } catch {
    /* haptics are optional on unsupported browsers */
  }
}

export function hapticSelectionEnd() {
  if (!globalThis.window) return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics"))
      void Haptics.selectionEnd().catch(() => undefined);
  } catch {
    /* haptics are optional on unsupported browsers */
  }
}
