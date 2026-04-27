import type { ColorMode, Pixel, PixelMap, RgbColor } from "../types.js";
import {
  colorDistanceSquared,
  compositeOnWhite,
  luminance,
  normalizeHexColor,
  parseHexColor,
} from "../utils/colors.js";

function closestPaletteIndex(color: RgbColor, palette: RgbColor[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, candidate] of palette.entries()) {
    const distance = colorDistanceSquared(color, candidate);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export function quantizePixels(
  image: {
    width: number;
    height: number;
    channels: number;
    data: Buffer;
  },
  options: {
    colorMode: ColorMode;
    monoThreshold: number;
    palette: string[];
  },
): PixelMap {
  const normalizedPalette = options.palette.map(normalizeHexColor);
  const palette = normalizedPalette.map(parseHexColor);
  const pixelMap: PixelMap = [];

  for (let y = 0; y < image.height; y += 1) {
    const row: Pixel[] = [];

    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * image.channels;
      const r = image.data[offset] ?? 0;
      const g = image.data[offset + 1] ?? 0;
      const b = image.data[offset + 2] ?? 0;
      const a = image.channels >= 4 ? (image.data[offset + 3] ?? 255) : 255;
      const rgb = compositeOnWhite(r, g, b, a);

      const colorIndex =
        options.colorMode === "mono"
          ? luminance(rgb) < options.monoThreshold
            ? 0
            : Math.min(1, palette.length - 1)
          : closestPaletteIndex(rgb, palette);

      row.push({
        x,
        y,
        colorIndex,
        colorHex: normalizedPalette[colorIndex] ?? normalizedPalette[0] ?? "#000000",
      });
    }

    pixelMap.push(row);
  }

  return pixelMap;
}
