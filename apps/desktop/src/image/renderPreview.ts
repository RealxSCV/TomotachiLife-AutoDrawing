import sharp from "sharp";

import type { PixelMap } from "../types.js";
import { ensureParentDirectory } from "../utils/fs.js";
import { parseHexColor } from "../utils/colors.js";

function buildPreviewBuffer(pixelMap: PixelMap): Buffer {
  const height = pixelMap.length;
  const width = pixelMap[0]?.length ?? 0;

  if (width === 0 || height === 0) {
    throw new Error("Cannot render preview for an empty pixel map.");
  }

  const buffer = Buffer.alloc(width * height * 3);

  for (const row of pixelMap) {
    for (const pixel of row) {
      const color = parseHexColor(pixel.colorHex);
      const offset = (pixel.y * width + pixel.x) * 3;
      buffer[offset] = color.r;
      buffer[offset + 1] = color.g;
      buffer[offset + 2] = color.b;
    }
  }

  return buffer;
}

export async function renderPreviewToBuffer(pixelMap: PixelMap, scale = 12): Promise<Buffer> {
  const height = pixelMap.length;
  const width = pixelMap[0]?.length ?? 0;
  const buffer = buildPreviewBuffer(pixelMap);

  return sharp(buffer, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .resize(width * scale, height * scale, {
      kernel: sharp.kernel.nearest,
      fit: "fill",
    })
    .png()
    .toBuffer();
}

export async function renderPreview(
  pixelMap: PixelMap,
  outputPath: string,
  scale = 12,
): Promise<void> {
  await ensureParentDirectory(outputPath);

  const previewBuffer = await renderPreviewToBuffer(pixelMap, scale);
  await sharp(previewBuffer).toFile(outputPath);
}
