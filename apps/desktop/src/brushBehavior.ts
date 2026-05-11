import type { BrushShape, BrushSize, DrawingProfile } from "./types.js";

const HOME_CALIBRATION_PIXELS = 128;

export function normalizeBrushShape(
  value: unknown,
  fallback: BrushShape = "square",
): BrushShape {
  if (value === "round" || value === "square") {
    return value;
  }

  return fallback;
}

export function isUnsupportedBrushShapeSelection(
  brushShape: BrushShape,
  brushSize: BrushSize,
): boolean {
  return brushShape === "round" && brushSize > 1;
}

export function getUnsupportedBrushShapeMessage(
  brushShape: BrushShape,
  brushSize: BrushSize,
): string | null {
  if (!isUnsupportedBrushShapeSelection(brushShape, brushSize)) {
    return null;
  }

  return `当前仅支持 1 号圆形笔刷；圆形 ${brushSize} 号大笔刷暂不支持，请切回方形笔刷或使用 1 号笔。`;
}

export function getUnsupportedBrushShapeMessageForProfile(
  profile: Pick<DrawingProfile, "brushShape" | "brushSize">,
): string | null {
  return getUnsupportedBrushShapeMessage(profile.brushShape, profile.brushSize);
}

export function estimateSquareBrushStrideMoveHoldMs(
  stride: number,
  timing: {
    buttonPressMs: number;
    homeMs: number;
  },
): number {
  if (!Number.isFinite(stride) || stride <= 1) {
    return Math.max(1, Math.round(timing.buttonPressMs));
  }

  const normalizedStride = Math.max(1, Math.round(stride));
  const buttonPressMs = Math.max(1, Math.round(timing.buttonPressMs));
  const perPixelHomeMs = Math.max(1, Math.floor(Math.max(1, timing.homeMs) / HOME_CALIBRATION_PIXELS));

  return buttonPressMs + perPixelHomeMs * (normalizedStride - 1);
}
