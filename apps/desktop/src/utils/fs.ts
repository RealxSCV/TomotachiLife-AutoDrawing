import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function ensureParentDirectory(filePath: string): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
}
