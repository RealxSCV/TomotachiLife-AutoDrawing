import { existsSync } from "node:fs";

import { SerialPort } from "serialport";

export interface SerialPortInfo {
  path: string;
  label: string;
}

export function preferSerialPath(path: string): string {
  if (process.platform !== "darwin" || !path.startsWith("/dev/tty.")) {
    return path;
  }

  const preferredPath = path.replace("/dev/tty.", "/dev/cu.");
  return existsSync(preferredPath) ? preferredPath : path;
}

export async function listPortInfos(): Promise<SerialPortInfo[]> {
  const ports = await SerialPort.list();

  return ports.map((port) => {
    const preferredPath = preferSerialPath(port.path);
    const meta = [
      port.manufacturer,
      port.vendorId && port.productId ? `${port.vendorId}:${port.productId}` : undefined,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      path: preferredPath,
      label: meta.length > 0 ? `${preferredPath}  ${meta}` : preferredPath,
    };
  });
}

export async function listPorts(): Promise<string[]> {
  const ports = await listPortInfos();
  return ports.map((port) => port.label);
}
