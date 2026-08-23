import { useTrackBootstrapLifecycle } from "./useTrackBootstrapLifecycle";
import { useTrackCloudLifecycle } from "./useTrackCloudLifecycle";
import { useTrackIdentityLifecycle } from "./useTrackIdentityLifecycle";
import { useTrackPreferencesLifecycle } from "./useTrackPreferencesLifecycle";
import { useTrackTimerLifecycle } from "./useTrackTimerLifecycle";
import { useTrackUiLifecycle } from "./useTrackUiLifecycle";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackAppLifecycle(options: UseTrackAppLifecycleOptions) {
  useTrackBootstrapLifecycle(options);
  useTrackPreferencesLifecycle(options);
  useTrackIdentityLifecycle(options);
  useTrackCloudLifecycle(options);
  useTrackTimerLifecycle(options);
  useTrackUiLifecycle(options);
}
