import { useCallback } from "react";

type HapticType = "light" | "medium" | "heavy" | "success" | "error";

const hapticPatterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  error: [50, 30, 50],
};

export const useHaptic = () => {
  const trigger = useCallback((type: HapticType = "light") => {
    if (!("vibrate" in navigator)) return;

    try {
      const pattern = hapticPatterns[type];
      navigator.vibrate(pattern);
    } catch (error) {
      // Silently fail if vibration is not supported
    }
  }, []);

  return { trigger };
};

// Standalone function for non-hook contexts
export const triggerHaptic = (type: HapticType = "light") => {
  if (!("vibrate" in navigator)) return;

  try {
    const pattern = hapticPatterns[type];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail
  }
};
