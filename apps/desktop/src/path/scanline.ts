import type { DrawingProfile, Pixel, PixelMap, ResumePlan, ResumeSegment } from "../types.js";
import {
  createBrushGrid,
  gridCellToCanvasCenter,
  type BrushGrid,
} from "../brushGrid.js";
import { officialPaletteCellFromIndex } from "../config/officialPalette.js";
import {
  adjustPaletteCommand,
  basicPaletteConfigCommand,
  basicPaletteResetCommand,
  colorCommand,
  drawCommand,
  endCommand,
  homeCommand,
  inputConfigCommand,
  lineCommand,
  moveCommand,
  paletteConfigCommand,
  type DrawCommand,
} from "../protocol/commands.js";
import { serializeCommand, serializeCommands } from "../protocol/serializer.js";

export type PathStrategy = "scanline" | "nearest";
export interface GeneratedScanlinePlan {
  commands: DrawCommand[];
  resumePlan: ResumePlan;
}

const PALETTE_SLOT_COUNT = 9;
const EXACT_COMPONENT_ORDER_LIMIT = 6;
const EXACT_COMPONENT_PIXEL_LIMIT = 300;
const NEIGHBOR_OFFSETS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

// --- 颜色→HSV 步数换算（与固件 controller.cpp 一致） ---

interface HsvSteps {
  hue: number;  // ZR 按键次数（色相距 hue=0 的步数），范围 0-200
  sat: number;  // → 方向按键次数（饱和度距 sat=0 的步数），范围 0-213
  val: number;  // ↓ 方向按键次数（明度距 val=1.0 的步数），范围 0-112
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/u, "");
  const value = Number.parseInt(cleaned, 16);

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rf) {
      h = 60 * (((gf - bf) / delta) % 6);
    } else if (max === gf) {
      h = 60 * (((bf - rf) / delta) + 2);
    } else {
      h = 60 * (((rf - gf) / delta) + 4);
    }
  }

  if (h < 0) h += 360;

  const s = max <= 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

/** hex → HSV → 固件编辑器中的步数坐标 */
function hexToHsvSteps(hex: string): HsvSteps {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, v } = rgbToHsv(r, g, b);

  // 与固件 controller.cpp 的 rgbToHsv + scaleChannelToSteps 一致
  const hueSteps = h <= 0 ? 0 : Math.round(((360 - h) / 360) * 200);
  const satSteps = Math.round(s * 213);
  const valSteps = Math.round((1 - v) * 112);

  return { hue: hueSteps, sat: satSteps, val: valSteps };
}

// ---------------------------------

function groupPixelsByColor(pixelMap: PixelMap): Map<number, Pixel[]> {
  const byColor = new Map<number, Pixel[]>();

  for (const row of pixelMap) {
    for (const pixel of row) {
      if (pixel.alpha <= 0 || pixel.colorIndex < 0) continue;

      let arr = byColor.get(pixel.colorIndex);
      if (!arr) {
        arr = [];
        byColor.set(pixel.colorIndex, arr);
      }
      arr.push(pixel);
    }
  }

  return byColor;
}

function getLegacyScanlinePixels(pixels: Pixel[]): Pixel[] {
  if (pixels.length === 0) return [];

  const rowsByY = new Map<number, Pixel[]>();
  for (const p of pixels) {
    let row = rowsByY.get(p.y);
    if (!row) {
      row = [];
      rowsByY.set(p.y, row);
    }
    row.push(p);
  }

  const sortedY = [...rowsByY.keys()].sort((a, b) => a - b);
  return sortedY.flatMap((y) => {
    const row = rowsByY.get(y)!;
    const sorted = [...row].sort((a, b) => a.x - b.x);
    return y % 2 === 0 ? sorted : sorted.reverse();
  });
}

function pixelKey(point: { x: number; y: number }): string {
  return `${point.x},${point.y}`;
}

function buildSerpentineRows(pixels: Pixel[], fromBottom = false): Pixel[] {
  const rows = new Map<number, Pixel[]>();

  for (const pixel of pixels) {
    const row = rows.get(pixel.y);
    if (row) {
      row.push(pixel);
    } else {
      rows.set(pixel.y, [pixel]);
    }
  }

  const sortedRows = Array.from(rows.entries()).sort((left, right) => left[0] - right[0]);

  if (fromBottom) {
    sortedRows.reverse();
  }

  return sortedRows.flatMap(([rowNumber, row]) => {
    const sorted = [...row].sort((left, right) => left.x - right.x);

    if (rowNumber % 2 === 0) {
      return sorted;
    }

    return sorted.reverse();
  });
}

function chooseBestSerpentineOrder(
  pixels: Pixel[],
  current: { x: number; y: number },
  grid: BrushGrid,
): Pixel[] {
  if (pixels.length <= 1) {
    return pixels;
  }

  const topDown = buildSerpentineRows(pixels, false);
  const bottomUp = buildSerpentineRows(pixels, true);
  const candidates = [
    topDown,
    [...topDown].reverse(),
    bottomUp,
    [...bottomUp].reverse(),
  ];
  let bestOrder = candidates[0] ?? pixels;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.length === 0) {
      continue;
    }

    const distance = estimateTravelDistance(current, candidate, grid);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestOrder = candidate;
    }
  }

  return bestOrder;
}

function collectConnectedComponents(pixels: Pixel[]): Pixel[][] {
  if (pixels.length === 0) {
    return [];
  }

  const pixelByKey = new Map<string, Pixel>(pixels.map((pixel) => [pixelKey(pixel), pixel]));
  const visited = new Set<string>();
  const components: Pixel[][] = [];

  for (const pixel of pixels) {
    const startKey = pixelKey(pixel);
    if (visited.has(startKey)) {
      continue;
    }

    const stack = [pixel];
    const component: Pixel[] = [];
    visited.add(startKey);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);

      for (const offset of NEIGHBOR_OFFSETS) {
        const neighbor = pixelByKey.get(
          pixelKey({ x: current.x + offset.dx, y: current.y + offset.dy }),
        );

        if (!neighbor) {
          continue;
        }

        const neighborKey = pixelKey(neighbor);

        if (visited.has(neighborKey)) {
          continue;
        }

        visited.add(neighborKey);
        stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function getNearestNeighborPixels(
  pixels: Pixel[],
  current: { x: number; y: number },
  grid: BrushGrid,
): Pixel[] {
  if (pixels.length === 0) return [];

  const remaining = new Map<string, Pixel>(pixels.map((pixel) => [pixelKey(pixel), pixel]));
  const ordered: Pixel[] = [];
  let lastDir: { dx: number; dy: number } | null = null;
  let last: Pixel | null = null;
  let position = current;

  while (remaining.size > 0) {
    let next: Pixel | null = null;

    if (last && lastDir) {
      const candidate = remaining.get(pixelKey({ x: last.x + lastDir.dx, y: last.y + lastDir.dy }));
      if (candidate) {
        next = candidate;
      }
    }

    if (!next && last) {
      for (const offset of NEIGHBOR_OFFSETS) {
        const candidate = remaining.get(pixelKey({ x: last.x + offset.dx, y: last.y + offset.dy }));
        if (candidate) {
          next = candidate;
          break;
        }
      }
    }

    if (!next) {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of remaining.values()) {
        const target = toCanvasPosition(candidate, grid);
        const distance = Math.abs(target.x - position.x) + Math.abs(target.y - position.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          next = candidate;
        }
      }
    }

    if (!next) break;

    if (last) {
      const dx = next.x - last.x;
      const dy = next.y - last.y;
      const isUnitStep = Math.abs(dx) + Math.abs(dy) === 1;
      lastDir = isUnitStep ? { dx, dy } : null;
    }
    ordered.push(next);
    remaining.delete(pixelKey(next));
    position = toCanvasPosition(next, grid);
    last = next;
  }

  return ordered;
}

function getNearestNeighborPixelsByComponents(
  pixels: Pixel[],
  current: { x: number; y: number },
  grid: BrushGrid,
): Pixel[] {
  const components = collectConnectedComponents(pixels);
  if (components.length <= 1) {
    return getNearestNeighborPixels(pixels, current, grid);
  }

  const remaining = components.slice();
  const ordered: Pixel[] = [];
  let position = current;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const component = remaining[i]!;
      for (const pixel of component) {
        const target = toCanvasPosition(pixel, grid);
        const distance = Math.abs(target.x - position.x) + Math.abs(target.y - position.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
          if (distance === 0) break;
        }
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    if (!chosen) break;

    const sub = getNearestNeighborPixels(chosen, position, grid);
    if (sub.length === 0) continue;

    ordered.push(...sub);
    const lastPixel = sub[sub.length - 1]!;
    position = toCanvasPosition(lastPixel, grid);
  }

  return ordered;
}

function getOrderedPixelsForColor(
  pixelsByColor: Map<number, Pixel[]>,
  colorIndex: number,
  current: { x: number; y: number },
  profile: DrawingProfile,
  grid: BrushGrid,
  pathStrategy: PathStrategy,
): Pixel[] {
  const pixels = pixelsByColor.get(colorIndex);
  if (!pixels || pixels.length === 0) return [];

  if (pathStrategy === "nearest") {
    return getNearestNeighborPixelsByComponents(pixels, current, grid);
  }

  const components = collectConnectedComponents(pixels);
  const legacyPixels = chooseBestSerpentineOrder(pixels, current, grid);

  if (components.length <= 1) {
    return legacyPixels;
  }

  let orderedPixels: Pixel[];

  if (
    components.length <= EXACT_COMPONENT_ORDER_LIMIT &&
    pixels.length <= EXACT_COMPONENT_PIXEL_LIMIT
  ) {
    orderedPixels = findOptimalComponentOrder(components, current, grid);
  } else {
    orderedPixels = greedyComponentOrder(components, current, grid);
  }

  const optimizedDistance = estimateTravelDistance(current, orderedPixels, grid);
  const legacyDistance = estimateTravelDistance(current, legacyPixels, grid);

  return optimizedDistance < legacyDistance ? orderedPixels : legacyPixels;
}

function greedyComponentOrder(
  components: Pixel[][],
  current: { x: number; y: number },
  grid: BrushGrid,
): Pixel[] {
  const remaining = [...components];
  const orderedPixels: Pixel[] = [];
  let currentPosition = current;

  while (remaining.length > 0) {
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;
    let selectedOrder: Pixel[] = [];

    remaining.forEach((component, index) => {
      const candidate = chooseBestSerpentineOrder(component, currentPosition, grid);

      if (candidate.length === 0) return;

      const firstPixel = candidate[0];
      if (!firstPixel) return;

      const start = toCanvasPosition(firstPixel, grid);
      const distance =
        Math.abs(start.x - currentPosition.x) + Math.abs(start.y - currentPosition.y);

      if (distance < selectedDistance) {
        selectedDistance = distance;
        selectedIndex = index;
        selectedOrder = candidate;
      }
    });

    const lastPixel = selectedOrder[selectedOrder.length - 1];

    if (selectedOrder.length > 0) {
      orderedPixels.push(...selectedOrder);
    }

    if (lastPixel) {
      currentPosition = toCanvasPosition(lastPixel, grid);
    }

    remaining.splice(selectedIndex, 1);
  }

  return orderedPixels;
}

function findOptimalComponentOrder(
  components: Pixel[][],
  current: { x: number; y: number },
  grid: BrushGrid,
): Pixel[] {
  if (components.length <= 1) {
    return chooseBestSerpentineOrder(components[0] ?? [], current, grid);
  }

  // Pre-compute top-down and bottom-up serpentine rows for each component
  const precomputed = components.map((comp) => ({
    topDown: buildSerpentineRows(comp, false),
    bottomUp: buildSerpentineRows(comp, true),
  }));

  function bestVariant(
    pre: (typeof precomputed)[number],
    pos: { x: number; y: number },
  ): { pixels: Pixel[]; endPos: { x: number; y: number } } {
    const candidates = [
      pre.topDown,
      [...pre.topDown].reverse(),
      pre.bottomUp,
      [...pre.bottomUp].reverse(),
    ];
    let bestPixels: Pixel[] = [];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      if (candidate.length === 0) {
        continue;
      }

      const distance = estimateTravelDistance(pos, candidate, grid);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPixels = candidate;
      }
    }

    const last = bestPixels[bestPixels.length - 1];
    return {
      pixels: bestPixels,
      endPos: last ? toCanvasPosition(last, grid) : pos,
    };
  }

  let bestOrder: Pixel[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;

  function* permute<T>(arr: T[]): Generator<T[]> {
    if (arr.length <= 1) {
      yield arr;
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permute(rest)) {
        yield [arr[i]!, ...p];
      }
    }
  }

  const indices = [...Array(components.length).keys()];

  for (const order of permute(indices)) {
    let pos = current;
    let totalDist = 0;
    const ordered: Pixel[] = [];

    for (const idx of order) {
      const pre = precomputed[idx];
      if (!pre) continue;
      const variant = bestVariant(pre, pos);

      if (variant.pixels.length === 0) continue;

      const first = variant.pixels[0];
      if (first) {
        const startPos = toCanvasPosition(first, grid);
        totalDist += Math.abs(startPos.x - pos.x) + Math.abs(startPos.y - pos.y);
      }

      ordered.push(...variant.pixels);
      pos = variant.endPos;
    }

    if (totalDist < bestDistance) {
      bestDistance = totalDist;
      bestOrder = ordered;
    }
  }

  return bestOrder;
}

function toCanvasPosition(
  point: { x: number; y: number },
  grid: BrushGrid,
): { x: number; y: number } {
  return gridCellToCanvasCenter(grid, point);
}

function moveTo(
  current: { x: number; y: number },
  target: { x: number; y: number },
  grid: BrushGrid,
): DrawCommand[] {
  const canvasTarget = toCanvasPosition(target, grid);
  const dx = canvasTarget.x - current.x;
  const dy = canvasTarget.y - current.y;

  if (dx === 0 && dy === 0) {
    return [];
  }

  return [moveCommand(dx, dy)];
}

function estimateTravelDistance(
  current: { x: number; y: number },
  pixels: Pixel[],
  grid: BrushGrid,
): number {
  let total = 0;
  let currentPosition = current;

  for (const pixel of pixels) {
    const next = toCanvasPosition(pixel, grid);
    total += Math.abs(next.x - currentPosition.x) + Math.abs(next.y - currentPosition.y);
    currentPosition = next;
  }

  return total;
}

function resolveStartOffset(profile: DrawingProfile): { dx: number; dy: number } | null {
  if (profile.startCursor === "top-left") {
    return null;
  }

  const dx =
    profile.centerToTopLeftDx !== 0 ? profile.centerToTopLeftDx : -Math.floor(profile.canvasWidth / 2);
  const dy =
    profile.centerToTopLeftDy !== 0 ? profile.centerToTopLeftDy : -Math.floor(profile.canvasHeight / 2);

  if (dx === 0 && dy === 0) {
    return null;
  }

  return { dx, dy };
}

function shouldStartFromCanvasCenter(profile: DrawingProfile): boolean {
  return profile.startCursor === "center";
}

function getUsedPaletteColors(pixelMap: PixelMap): Array<{ colorIndex: number; colorHex: string }> {
  const colorStats = new Map<number, { hex: string, count: number }>();
  let maxCount = -1;
  let maxColorIndex = -1;

  // 一次遍历完成：统计像素数量 + 找出最多的颜色
  for (const row of pixelMap) {
    for (const pixel of row) {
      if (pixel.alpha <= 0 || pixel.colorIndex < 0) continue;
      const cIdx = pixel.colorIndex;
      const existing = colorStats.get(cIdx);
      
      if (existing) {
        existing.count += 1;
      } else {
        colorStats.set(cIdx, { hex: pixel.colorHex, count: 1 });
      }
      
      // 同时跟踪最多的颜色
      const currentCount = colorStats.get(cIdx)?.count ?? 0;
      if (currentCount > maxCount) {
        maxCount = currentCount;
        maxColorIndex = cIdx;
      }
    }
  }

  // 按 colorIndex 排序并重组
  const result: Array<{ colorIndex: number; colorHex: string }> = [];
  const maxEntry = colorStats.get(maxColorIndex);

  // 将所有颜色按原序添加，除了最大的
  for (const [index, stats] of Array.from(colorStats.entries()).sort((a, b) => a[0] - b[0])) {
    if (index !== maxColorIndex) {
      result.push({ colorIndex: index, colorHex: stats.hex });
    }
  }

  // 最后添加最多的颜色
  if (maxEntry) {
    result.push({ colorIndex: maxColorIndex, colorHex: maxEntry.hex });
  }

  return result;
}
function canExtendRun(run: Pixel[], pixel: Pixel): boolean {
  const previous = run[run.length - 1];

  if (!previous) {
    return true;
  }

  if (run.length === 1) {
    return (
      (previous.y === pixel.y && Math.abs(previous.x - pixel.x) === 1) ||
      (previous.x === pixel.x && Math.abs(previous.y - pixel.y) === 1)
    );
  }

  const prevPrev = run[run.length - 2];
  if (!prevPrev) {
    return (
      previous.y === pixel.y && Math.abs(previous.x - pixel.x) === 1
    );
  }

  const isHorizontal = prevPrev.y === previous.y;

  if (isHorizontal) {
    return previous.y === pixel.y && Math.abs(previous.x - pixel.x) === 1;
  }

  return previous.x === pixel.x && Math.abs(previous.y - pixel.y) === 1;
}

function appendPixelRun(
  commands: DrawCommand[],
  run: Pixel[],
  current: { x: number; y: number },
  profile: DrawingProfile,
  grid: BrushGrid,
): { x: number; y: number } {
  const firstPixel = run[0];
  const lastPixel = run[run.length - 1];

  if (!firstPixel || !lastPixel) {
    return current;
  }

  commands.push(...moveTo(current, firstPixel, grid));

  if (run.length === 1) {
    commands.push(drawCommand(profile.drawButton));
  } else {
    const firstPosition = toCanvasPosition(firstPixel, grid);
    const lastPosition = toCanvasPosition(lastPixel, grid);
    commands.push(lineCommand(lastPosition.x - firstPosition.x, lastPosition.y - firstPosition.y));
  }

  return toCanvasPosition(lastPixel, grid);
}

function appendOrderedPixels(
  commands: DrawCommand[],
  orderedPixels: Pixel[],
  current: { x: number; y: number },
  profile: DrawingProfile,
  grid: BrushGrid,
): { x: number; y: number } {
  let currentPosition = current;
  let run: Pixel[] = [];

  for (const pixel of orderedPixels) {
    if (canExtendRun(run, pixel)) {
      run.push(pixel);
      continue;
    }

    currentPosition = appendPixelRun(commands, run, currentPosition, profile, grid);
    run = [pixel];
  }

  return appendPixelRun(commands, run, currentPosition, profile, grid);
}

function buildResumeLabel(
  profile: DrawingProfile,
  segmentIndex: number,
  colorHex: string | null,
  slotIndex: number | null,
): string {
  if (profile.colorMode === "mono") {
    return "单色重绘";
  }

  const normalizedColor = colorHex ? colorHex.toUpperCase() : "未知颜色";
  const slotLabel = slotIndex === null ? "" : ` · 槽位 ${slotIndex + 1}`;
  const prefix = profile.colorMode === "official" ? "官方色" : "自定义色";

  return `${prefix} ${segmentIndex + 1} · ${normalizedColor}${slotLabel}`;
}

function appendResumeSegment(
  commands: DrawCommand[],
  resumeSegments: ResumeSegment[],
  orderedPixels: Pixel[],
  current: { x: number; y: number },
  profile: DrawingProfile,
  grid: BrushGrid,
  meta: {
    segmentIndex: number;
    colorHex: string | null;
    slotIndex: number | null;
    resumePrefixCommands: DrawCommand[];
  },
): { x: number; y: number } {
  const firstPixel = orderedPixels[0];

  if (!firstPixel) {
    return current;
  }

  const firstCanvasPosition = toCanvasPosition(firstPixel, grid);
  const needsInitialMove =
    firstCanvasPosition.x !== current.x || firstCanvasPosition.y !== current.y;
  const bodyStartCommandIndex = commands.length + (needsInitialMove ? 1 : 0);
  const nextPosition = appendOrderedPixels(commands, orderedPixels, current, profile, grid);

  resumeSegments.push({
    segmentIndex: meta.segmentIndex,
    label: buildResumeLabel(profile, meta.segmentIndex, meta.colorHex, meta.slotIndex),
    colorHex: meta.colorHex,
    slotIndex: meta.slotIndex,
    resumePrefixCommands: serializeCommands(meta.resumePrefixCommands),
    firstCanvasPosition,
    bodyStartCommandIndex,
    commandEndExclusive: commands.length,
  });

  return nextPosition;
}

export function generateScanlinePlan(
  pixelMap: PixelMap,
  profile: DrawingProfile,
  pathStrategy: PathStrategy = "scanline",
): GeneratedScanlinePlan {
  const commands: DrawCommand[] = [];
  const grid = createBrushGrid(profile);
  const resumeSegments: ResumeSegment[] = [];
  let current = { x: 0, y: 0 };
  let segmentIndex = 0;

  const inputConfig = inputConfigCommand(
    profile.buttonPressDuration,
    profile.inputDelay,
    profile.homeDuration,
  );
  commands.push(inputConfig);

  if (shouldStartFromCanvasCenter(profile)) {
    current = {
      x: Math.floor(profile.canvasWidth / 2),
      y: Math.floor(profile.canvasHeight / 2),
    };
  } else {
    const startOffset = resolveStartOffset(profile);
    if (startOffset) {
      commands.push(moveCommand(startOffset.dx, startOffset.dy));
    } else {
      commands.push(homeCommand());
    }
  }

  const initialCursor = { ...current };

  // Pre-group pixels by color to avoid repeated full-map scans
  const pixelsByColor = groupPixelsByColor(pixelMap);

  if (profile.colorMode === "mono") {
    const usedColorIndexes = [profile.startColorIndex];
    let selectedColor: number | null = profile.startColorIndex;

    for (const colorIndex of usedColorIndexes) {
      if (selectedColor !== colorIndex) {
        commands.push(colorCommand(colorIndex));
        selectedColor = colorIndex;
      }

      const orderedPixels = getOrderedPixelsForColor(pixelsByColor, colorIndex, current, profile, grid, pathStrategy);
      current = appendResumeSegment(
        commands,
        resumeSegments,
        orderedPixels,
        current,
        profile,
        grid,
        {
          segmentIndex,
          colorHex: orderedPixels[0]?.colorHex ?? null,
          slotIndex: null,
          resumePrefixCommands: profile.startColorIndex === 0 ? [] : [colorCommand(profile.startColorIndex)],
        },
      );
      segmentIndex += 1;
    }
  } else if (profile.colorMode === "palette") {
    const usedColors = getUsedPaletteColors(pixelMap);
    let lastHsvSteps: HsvSteps | null = null;

    for (const color of usedColors) {
      // 始终配置槽 0（当前选中色）
      const isFirstColor = lastHsvSteps === null;
      const targetSteps = hexToHsvSteps(color.colorHex);
      let dHue = 0;
      let dSat = 0;
      let dVal = 0;
      let prefixCommands: DrawCommand[];

      if (isFirstColor) {
        // 第一色：走绝对调色（带归位）
        commands.push(paletteConfigCommand(0, color.colorHex));
        prefixCommands = [paletteConfigCommand(0, color.colorHex), colorCommand(0)];
      } else {
        // 后续色：计算相对增量
        dHue = targetSteps.hue - lastHsvSteps!.hue;
        dSat = targetSteps.sat - lastHsvSteps!.sat;
        dVal = targetSteps.val - lastHsvSteps!.val;
        commands.push(adjustPaletteCommand(0, dHue, dSat, dVal));
        prefixCommands = [adjustPaletteCommand(0, dHue, dSat, dVal), colorCommand(0)];
      }

      commands.push(colorCommand(0));
      lastHsvSteps = targetSteps;

      const orderedPixels = getOrderedPixelsForColor(pixelsByColor, color.colorIndex, current, profile, grid, pathStrategy);
      current = appendResumeSegment(
        commands,
        resumeSegments,
        orderedPixels,
        current,
        profile,
        grid,
        {
          segmentIndex,
          colorHex: color.colorHex,
          slotIndex: 0,
          resumePrefixCommands: prefixCommands,
        },
      );
      segmentIndex += 1;
    }
  } else {
    const usedColors = getUsedPaletteColors(pixelMap);

    for (const color of usedColors) {
      const cell = officialPaletteCellFromIndex(color.colorIndex);

      // 始终配置槽 0（当前选中色）；已内置基本色 delta 追踪，无需归位
      commands.push(basicPaletteConfigCommand(0, cell.row, cell.col));
      commands.push(colorCommand(0));

      const orderedPixels = getOrderedPixelsForColor(pixelsByColor, color.colorIndex, current, profile, grid, pathStrategy);
      current = appendResumeSegment(
        commands,
        resumeSegments,
        orderedPixels,
        current,
        profile,
        grid,
        {
          segmentIndex,
          colorHex: color.colorHex,
          slotIndex: 0,
          resumePrefixCommands: [
            basicPaletteConfigCommand(0, cell.row, cell.col),
            colorCommand(0),
          ],
        },
      );
      segmentIndex += 1;
    }
  }

  commands.push(endCommand());
  return {
    commands,
    resumePlan: {
      inputConfigCommand: serializeCommand(inputConfig),
      initialCursor,
      segments: resumeSegments,
    },
  };
}

export function generateScanlineCommands(
  pixelMap: PixelMap,
  profile: DrawingProfile,
  pathStrategy: PathStrategy = "scanline",
): DrawCommand[] {
  return generateScanlinePlan(pixelMap, profile, pathStrategy).commands;
}

export function estimateRuntimeMs(commands: DrawCommand[], profile: DrawingProfile): number {
  let timing = {
    buttonPressMs: profile.buttonPressDuration,
    inputDelayMs: profile.inputDelay,
    homeMs: profile.homeDuration,
  };

  return commands.reduce((total, command) => {
    switch (command.type) {
      case "inputConfig":
        timing = {
          buttonPressMs: command.buttonPressMs,
          inputDelayMs: command.inputDelayMs,
          homeMs: command.homeMs,
        };
        return total;
      case "home":
        return total + timing.homeMs * 2 + timing.inputDelayMs;
      case "move":
        return (
          total +
          (Math.abs(command.dx) + Math.abs(command.dy)) *
            (timing.buttonPressMs + timing.inputDelayMs)
        );
      case "line":
        return (
          total +
          (Math.abs(command.dx) + Math.abs(command.dy) + 1) *
            (timing.buttonPressMs + timing.inputDelayMs)
        );
      case "draw":
      case "press":
        return total + timing.buttonPressMs + timing.inputDelayMs;
      case "color":
        return total + profile.colorChangeDuration;
      case "paletteConfig":
        return total + profile.colorChangeDuration * 6;
      case "basicPaletteConfig":
        return total + profile.colorChangeDuration * 4;
      case "adjustPalette": {
        const stepCount = Math.abs(command.dHue) + Math.abs(command.dSat) + Math.abs(command.dVal);
        return total + stepCount * (timing.buttonPressMs + timing.inputDelayMs) + timing.inputDelayMs * 3;
      }
      case "basicPaletteReset":
        return total + timing.inputDelayMs;
      case "wait":
        return total + command.ms;
      case "pause":
      case "resume":
      case "end":
        return total + timing.inputDelayMs;
      default:
        return total;
    }
  }, 0);
}
