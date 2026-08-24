"use client";

type MotionValue = string | number;
type MotionValues = Record<string, MotionValue>;
type AnimatedElement = HTMLElement & {
  animate: (keyframes: Keyframe[] | PropertyIndexedKeyframes, options?: number | KeyframeAnimationOptions) => Animation;
};

function supportsWebAnimations(element: HTMLElement): element is AnimatedElement {
  return "animate" in element && typeof element.animate === "function";
}

// Web Animations API effects do not create JSX style attributes. Keeping one
// effect per property also prevents a drag animation from cancelling an
// unrelated animation on the same element.
const activeEffects = new WeakMap<HTMLElement, Map<string, Animation>>();

function effectMap(element: HTMLElement) {
  let effects = activeEffects.get(element);
  if (!effects) {
    effects = new Map();
    activeEffects.set(element, effects);
  }
  return effects;
}

export function applyAnimatedStyles(element: HTMLElement | null, values: MotionValues, duration = 0) {
  if (!element || !supportsWebAnimations(element)) return;
  const effects = effectMap(element);
  const computed = getComputedStyle(element);
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const effectiveDuration = reducedMotion ? 0 : duration;

  for (const [property, rawValue] of Object.entries(values)) {
    effects.get(property)?.cancel();
    const value = String(rawValue);
    const current = computed.getPropertyValue(property).trim() || value;
    const from: Keyframe = { [property]: current };
    const to: Keyframe = { [property]: value };
    effects.set(
      property,
      element.animate([from, to], {
        duration: effectiveDuration,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "forwards",
      }),
    );
  }
}

export function clearAnimatedStyles(element: HTMLElement | null, properties?: string[]) {
  if (!element) return;
  const effects = activeEffects.get(element);
  if (!effects) return;
  const names = properties ?? [...effects.keys()];
  for (const property of names) {
    effects.get(property)?.cancel();
    effects.delete(property);
  }
  if (!effects.size) activeEffects.delete(element);
}
