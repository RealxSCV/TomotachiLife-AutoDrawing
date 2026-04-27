function parseTwoInts(line: string): { first: number; second: number } | null {
  const parts = line.trim().split(/\s+/u);

  if (parts.length !== 3) {
    return null;
  }

  const first = Number.parseInt(parts[1] ?? "", 10);
  const second = Number.parseInt(parts[2] ?? "", 10);

  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  return { first, second };
}

function parseOneInt(line: string): number | null {
  const parts = line.trim().split(/\s+/u);

  if (parts.length !== 2) {
    return null;
  }

  const value = Number.parseInt(parts[1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SimulatedDeviceResponse {
  ack: "OK" | `ERR ${string}`;
  lines: string[];
}

interface SimulatedDeviceState {
  x: number;
  y: number;
  colorIndex: number;
  drawCount: number;
  paused: boolean;
  ended: boolean;
}

export class SimulatedDevice {
  private readonly transportName = "simulated-device";
  private readonly injectedFailures = new Set<number>();
  private state: SimulatedDeviceState = {
    x: 0,
    y: 0,
    colorIndex: 0,
    drawCount: 0,
    paused: false,
    ended: false,
  };

  async executeCommand(
    line: string,
    options: {
      commandIndex: number;
      ackDelayMs: number;
      errorAtCommand?: number;
    },
  ): Promise<SimulatedDeviceResponse> {
    const trimmed = line.trim();
    const lines: string[] = [];

    if (
      options.errorAtCommand !== undefined &&
      options.commandIndex === options.errorAtCommand &&
      !this.injectedFailures.has(options.commandIndex)
    ) {
      this.injectedFailures.add(options.commandIndex);
      await delay(options.ackDelayMs);
      return {
        ack: `ERR injected failure at command ${options.commandIndex}`,
        lines,
      };
    }

    if (trimmed.length === 0) {
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "I") {
      lines.push(
        `INFO transport=${this.transportName} x=${this.state.x} y=${this.state.y} color=${this.state.colorIndex} draws=${this.state.drawCount}`,
      );
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "H") {
      this.state.x = 0;
      this.state.y = 0;
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "P") {
      this.state.drawCount += 1;
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "S") {
      this.state.paused = true;
      lines.push("INFO paused=true");
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "R") {
      this.state.paused = false;
      lines.push("INFO paused=false");
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "E") {
      this.state.ended = true;
      lines.push(
        `INFO end x=${this.state.x} y=${this.state.y} color=${this.state.colorIndex} draws=${this.state.drawCount}`,
      );
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed.startsWith("M ")) {
      const parsed = parseTwoInts(trimmed);

      if (!parsed) {
        await delay(options.ackDelayMs);
        return { ack: "ERR invalid move", lines };
      }

      this.state.x += parsed.first;
      this.state.y += parsed.second;
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed.startsWith("C ")) {
      const colorIndex = parseOneInt(trimmed);

      if (colorIndex === null) {
        await delay(options.ackDelayMs);
        return { ack: "ERR invalid color", lines };
      }

      this.state.colorIndex = colorIndex;
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed.startsWith("W ")) {
      const waitMs = parseOneInt(trimmed);

      if (waitMs === null) {
        await delay(options.ackDelayMs);
        return { ack: "ERR invalid wait", lines };
      }

      await delay(waitMs + options.ackDelayMs);
      return { ack: "OK", lines };
    }

    if (trimmed === "A" || trimmed === "B" || trimmed === "X" || trimmed === "Y") {
      await delay(options.ackDelayMs);
      return { ack: "OK", lines };
    }

    await delay(options.ackDelayMs);
    return { ack: "ERR unknown command", lines };
  }
}
