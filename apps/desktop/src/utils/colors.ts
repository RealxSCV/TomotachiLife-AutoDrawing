import type { RgbColor } from "../types.js";

const HEX_COLOR_RE = /^#?([0-9a-f]{6})$/i;

export function parseHexColor(input: string): RgbColor {
  const match = HEX_COLOR_RE.exec(input.trim());

  if (!match) {
    throw new Error(`Invalid color: ${input}`);
  }

  const hex = match[1];

  if (!hex) {
    throw new Error(`Invalid color: ${input}`);
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function normalizeHexColor(input: string): string {
  const match = HEX_COLOR_RE.exec(input.trim());

  if (!match) {
    throw new Error(`Invalid color: ${input}`);
  }

  const hex = match[1];

  if (!hex) {
    throw new Error(`Invalid color: ${input}`);
  }

  return `#${hex.toLowerCase()}`;
}

export function rgbToHex(color: RgbColor): string {
  const channelToHex = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

export function compositeOnWhite(r: number, g: number, b: number, alpha: number): RgbColor {
  const opacity = alpha / 255;

  return {
    r: Math.round(r * opacity + 255 * (1 - opacity)),
    g: Math.round(g * opacity + 255 * (1 - opacity)),
    b: Math.round(b * opacity + 255 * (1 - opacity)),
  };
}

export function luminance(color: RgbColor): number {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

export function colorDistanceSquared(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;

  return dr * dr + dg * dg + db * db;
}
