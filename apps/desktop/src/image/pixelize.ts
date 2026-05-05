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
): PixelizationResult["pixelMap"] {
  const height = pixelMap.length;
  const width = pixelMap[0]?.length ?? 0;

  if (height === 0 || width === 0) {
    return pixelMap;
  }

  // 使用写时复制 (Copy-on-Write) 模式，只在修改时才复制
  let newMap: PixelizationResult["pixelMap"] | null = null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = pixelMap[y]?.[x];
      
      // 忽略透明像素
      if (!pixel || pixel.alpha <= 0 || pixel.colorIndex < 0) {
        continue;
      }

      const targetColor = pixel.colorIndex;
      let isIsolated = true;

      // 1. 5x5 范围检测：看看周围两圈有没有“同类”
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx === 0 && dy === 0) continue; // 跳过自己
          
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const neighbor = pixelMap[ny]?.[nx];
            if (neighbor && neighbor.alpha > 0 && neighbor.colorIndex === targetColor) {
              isIsolated = false; // 找到同类了，它不是孤立的
              break;
            }
          }
        }
        if (!isIsolated) break;
      }

      // 2. 如果真的是孤立像素，开始 3x3 范围的同化
      if (isIsolated) {
        const colorCounts = new Map<number, { count: number; hex: string }>();
        // 记录四个方向的颜色
        let topColor = -1, bottomColor = -1, leftColor = -1, rightColor = -1;

        // 收集周围一圈（3x3）的颜色
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const neighbor = pixelMap[ny]?.[nx];
              if (neighbor && neighbor.alpha > 0 && neighbor.colorIndex >= 0) {
                const cIdx = neighbor.colorIndex;
                
                // 记录正上、正下、正左、正右的颜色，留作打平局时的优先级参考
                if (dx === 0 && dy === -1) topColor = cIdx;
                if (dx === 0 && dy === 1) bottomColor = cIdx;
                if (dx === -1 && dy === 0) leftColor = cIdx;
                if (dx === 1 && dy === 0) rightColor = cIdx;

                const existing = colorCounts.get(cIdx);
                if (existing) {
                  existing.count += 1;
                } else {
                  colorCounts.set(cIdx, { count: 1, hex: neighbor.colorHex });
                }
              }
            }
          }
        }

        // 3. 找出数量最多的颜色替换它
        if (colorCounts.size > 0) {
          let maxCount = 0;
          for (const info of colorCounts.values()) {
            if (info.count > maxCount) maxCount = info.count;
          }

          // 挑出所有达到最高票数的颜色（可能有一个，也可能有多个打平）
          const candidates = Array.from(colorCounts.entries())
            .filter(([_, info]) => info.count === maxCount)
            .map(([idx, info]) => ({ idx, hex: info.hex }));

          // 建立候选颜色 Map，优化查找效率从 O(n) 改为 O(1)
          const candidateMap = new Map(candidates.map((c) => [c.idx, c]));
          const winner = candidateMap.get(topColor) 
            || candidateMap.get(bottomColor) 
            || candidateMap.get(leftColor) 
            || candidateMap.get(rightColor) 
            || candidates[0];

          // 4. 按需初始化 newMap（写时复制）
          if (!newMap) {
            newMap = pixelMap.map((row) => row.map((pixel) => ({ ...pixel })));
          }

          // 5. 安全地赋值
          const targetPixel = newMap?.[y]?.[x];
          if (winner && targetPixel) {
            targetPixel.colorIndex = winner.idx;
            targetPixel.colorHex = winner.hex;
          }
        }
      }
    }
  }

  return newMap ?? pixelMap;
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
    pixelMap = removeIsolatedPixels(pixelMap);
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
