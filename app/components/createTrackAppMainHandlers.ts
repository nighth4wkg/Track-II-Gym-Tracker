import type { ComponentProps } from "react";
import { haptic } from "../haptics";

type TrackAppMainHandlerOptions = Pick<
  ComponentProps<"main">,
  "onTouchStartCapture" | "onTouchEndCapture" | "onPointerDownCapture" | "onPointerCancelCapture"
>;

export function createTrackAppMainHandlers({
  onTouchStartCapture,
  onTouchEndCapture,
  onPointerDownCapture,
  onPointerCancelCapture,
}: TrackAppMainHandlerOptions): Pick<
  ComponentProps<"main">,
  "onTouchStartCapture" | "onTouchEndCapture" | "onPointerDownCapture" | "onPointerCancelCapture" | "onClickCapture"
> {
  return {
    onTouchStartCapture,
    onTouchEndCapture,
    onPointerDownCapture,
    onPointerCancelCapture,
    onClickCapture: (event) => {
      if (event.target instanceof Element && event.target.closest(".theme-toggle, .segmented-control button"))
        haptic(10);
    },
  };
}
