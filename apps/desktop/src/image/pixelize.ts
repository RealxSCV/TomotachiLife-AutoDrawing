import type { DrawingMask, DrawingProfile, PixelizationResult } from "../types.js";
import { createBrushGrid } from "../brushGrid.js";
import type { ImageSource } from "./loadImage.js";
import {
  applyDrawingMask,
  createDrawingMaskCoverageMap,
  isDrawingMaskCellEnabled,
  type DrawingMaskCoverageMap,
} from "./drawingMask.js";
import { autoRemoveBackground } from "./removeBackground.js";
import { resizeImage } from "./resizeImage.js";
import { quantizePixels } from "./quantize.js";

function collapsePixelMapForBrush(
  pixelMap: PixelizationResult["pixelMap"],
  profile: DrawingProfile,
  drawingMaskCoverageMap: DrawingMaskCoverageMap | null,
): PixelizationResult["pixelMap"] {
  const grid = createBrushGrid(profile);
  const collapsed: PixelizationResult["pixelMap"] = [];

  for (let logicalY = 0; logicalY < grid.gridHeight; logicalY += 1) {
    const row = [];
    const originY = grid.originY + logicalY * grid.brushSize;

    for (let logicalX = 0; logicalX < grid.gridWidth; logicalX += 1) {
      if (!isDrawingMaskCellEnabled(drawingMaskCoverageMap, { x: logicalX, y: logicalY })) {
        row.push({
          x: logicalX,
          y: logicalY,
          colorIndex: -1,
          colorHex: "#ffffff",
          alpha: 0,
        });
        continue;
      }

      const originX = grid.originX + logicalX * grid.brushSize;
      const colorCounts = new Map<
        number,
        {
          count: number;
          colorHex: string;
        }
      >();

      let fallbackPixel:
        | {
            colorIndex: number;
            colorHex: string;
          }
        | null = null;

      for (let dy = 0; dy < grid.brushSize; dy += 1) {
        const y = originY + dy;

        if (y >= pixelMap.length) {
          break;
        }

        const sourceRow = pixelMap[y];

        if (!sourceRow) {
          continue;
        }

        for (let dx = 0; dx < grid.brushSize; dx += 1) {
          const x = originX + dx;

          if (x >= sourceRow.length) {
            break;
          }

          const pixel = sourceRow[x];

          if (!pixel || pixel.alpha <= 0 || pixel.colorIndex < 0) {
            continue;
          }

          if (!fallbackPixel) {
            fallbackPixel = {
              colorIndex: pixel.colorIndex,
              colorHex: pixel.colorHex,
            };
          }

          const existing = colorCounts.get(pixel.colorIndex);

          if (existing) {
            existing.count += 1;
          } else {
            colorCounts.set(pixel.colorIndex, {
              count: 1,
              colorHex: pixel.colorHex,
            });
          }
        }
      }

      if (colorCounts.size === 0) {
        row.push({
          x: logicalX,
          y: logicalY,
          colorIndex: -1,
          colorHex: "#ffffff",
          alpha: 0,
        });
        continue;
      }

      let selectedColorIndex = fallbackPixel?.colorIndex ?? 0;
      let selectedColorHex = fallbackPixel?.colorHex ?? "#000000";
      let selectedCount = -1;

      for (const [colorIndex, info] of colorCounts.entries()) {
        if (info.count > selectedCount) {
          selectedColorIndex = colorIndex;
          selectedColorHex = info.colorHex;
          selectedCount = info.count;
        }
      }

      row.push({
        x: logicalX,
        y: logicalY,
        colorIndex: selectedColorIndex,
        colorHex: selectedColorHex,
        alpha: 255,
      });
    }

    collapsed.push(row);
  }

  return collapsed;
}

// --- 孤立像素去噪函数（带全方位平局检测） ---
function removeIsolatedPixels(
  pixelMap: PixelizationResult["pixelMap"],
  colorCount: number
): PixelizationResult["pixelMap"] {
  const height = pixelMap.length;
  const width = pixelMap[0]?.length ?? 0;
  if (height === 0 || width === 0) return pixelMap;

  // 1. 根据色阶设定容差：8/9色:0, 16色:1, 32色:2, 64色:3, 128色:4
  let tolerance = 0;
  if (colorCount >= 128) tolerance = 4;
  else if (colorCount >= 64) tolerance = 3;
  else if (colorCount >= 32) tolerance = 2;
  else if (colorCount >= 16) tolerance = 1;

  const newMap: PixelizationResult["pixelMap"] = pixelMap.map((row) =>
    row.map((pixel) => ({ ...pixel }))
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixelMap[y]?.[x];
      if (!pixel || pixel.alpha <= 0 || pixel.colorIndex < 0) continue;

      const targetColorIdx = pixel.colorIndex;
      let isIsolated = true;

      // 2. 5x5巡检
      neighborScan:
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const neighbor = pixelMap[ny]?.[nx];
            if (neighbor && neighbor.alpha > 0 && neighbor.colorIndex >= 0) {
              // 判定索引距离是否在容差内
              if (Math.abs(neighbor.colorIndex - targetColorIdx) <= tolerance) {
                isIsolated = false;
                break neighborScan;
              }
            }
          }
        }
      }

      // 3. 同化
      if (isIsolated) {
        const targetPixel = newMap[y]?.[x];
        if (!targetPixel) continue;
        
        const top = pixelMap[y - 1]?.[x];
        const bottom = pixelMap[y + 1]?.[x];
        const left = pixelMap[y]?.[x - 1];
        const right = pixelMap[y]?.[x + 1];

        const neighbor = (top && top.alpha > 0) ? top : 
                         (bottom && bottom.alpha > 0) ? bottom : 
                         (left && left.alpha > 0) ? left : 
                         (right && right.alpha > 0) ? right : null;
        if (neighbor) {
          targetPixel.colorIndex = neighbor.colorIndex;
          targetPixel.colorHex = neighbor.colorHex;
        } else {
          targetPixel.alpha = 0;
          targetPixel.colorIndex = -1;
        }
      }
    }
  }
  return newMap;
}

export async function pixelizeImage(
  imageSource: ImageSource,
  profile: DrawingProfile,
  options?: {
    imageScalePercent?: number;
    imageOffsetXPercent?: number;
    imageOffsetYPercent?: number;
    removeBackground?: boolean;
    drawingMask?: DrawingMask | null;
    enableDenoise?: boolean;
  },
): Promise<PixelizationResult> {
  const grid = createBrushGrid(profile);
  const resizeOptions = {
    width: profile.canvasWidth,
    height: profile.canvasHeight,
    resizeMode: profile.resizeMode,
    ...(options?.imageScalePercent !== undefined
      ? { scalePercent: options.imageScalePercent }
      : {}),
    ...(options?.imageOffsetXPercent !== undefined
      ? { offsetXPercent: options.imageOffsetXPercent }
      : {}),
    ...(options?.imageOffsetYPercent !== undefined
      ? { offsetYPercent: options.imageOffsetYPercent }
      : {}),
  };
  const resizedImage = await resizeImage(imageSource, resizeOptions);
  const backgroundAdjustedImage = options?.removeBackground ? autoRemoveBackground(resizedImage) : resizedImage;
  const maskedImage = applyDrawingMask(backgroundAdjustedImage, options?.drawingMask ?? null);
  const drawingMaskCoverageMap = createDrawingMaskCoverageMap(options?.drawingMask ?? null, grid);

  const fullPixelMap = quantizePixels(maskedImage, {
    colorMode: profile.colorMode,
    colorCount: profile.colorCount,
    monoThreshold: profile.monoThreshold,
    palette: profile.palette,
  });
  let pixelMap = collapsePixelMapForBrush(fullPixelMap, profile, drawingMaskCoverageMap);
  
  // 根据选项参数是否启用去噪
  const enableDenoise = options?.enableDenoise ?? profile.enableDenoise;
  if (enableDenoise) {
    pixelMap = removeIsolatedPixels(pixelMap, profile.colorCount);
  }

  const usedColorIndexes = Array.from(
    new Set(
      pixelMap.flatMap((row) =>
        row.filter((pixel) => pixel.alpha > 0 && pixel.colorIndex >= 0).map((pixel) => pixel.colorIndex),
      ),
    ),
  ).sort((a, b) => a - b);

  return {
    pixelMap,
    usedColorIndexes,
  };
}
