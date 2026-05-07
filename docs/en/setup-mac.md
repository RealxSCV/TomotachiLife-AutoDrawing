# macOS Notes

[简体中文](../setup-mac.md)

This document only covers `macOS`-specific differences.
For the full main flow, start with [Quick Start](user-trial-guide.md).

## 1. Current support scope

- Supported: packaged desktop app on `macOS`
- Supported: repo-based workflow

Current recommendation:

- Prefer the packaged `macOS` desktop app first

## 2. Most common macOS-specific differences

### 2.1 Serial device names

Common `macOS` serial names include:

- `/dev/cu.SLAB_USBtoUART`
- `/dev/cu.usbserial-*`
- other `cu.*` device names

If the app never shows any serial port:

1. Confirm the cable supports data transfer
2. Replug the board
3. Then confirm the driver is ready

### 2.2 Serial drivers

Different clone boards may use different USB-to-serial chips. Common examples:

- `CP210x`
- `CH340 / CH341`

If the board is connected but macOS still never exposes a matching serial device, verify that the correct driver for your board is installed.

## 3. Extra notes for the repo workflow on macOS

If you run from source, prepare these first:

- `Node.js 20+`
- `npm 10+`
- `PlatformIO Core 6+`

Common commands:

```bash
cd /path/to/friendmaker
npm install
npm run check
npm run ui:dev
```

You can also double-click:

- `Start Friend Maker.command`

That script jumps into `scripts/macos-launch.sh`, checks dependencies, and starts the local UI for you.

If the main problem is:

- `Homebrew` downloading too slowly
- `Node.js` downloading too slowly
- `npm install` taking too long
- `PlatformIO` or `Python` setup failing

## 4. Manual PlatformIO commands on macOS

Example firmware flash command:

```bash
cd /path/to/friendmaker/firmware/esp32
~/.platformio/penv/bin/pio run -e esp32dev_wireless -t upload
```

If your board behaves more like `NodeMCU-32S`, you can also use:

```bash
~/.platformio/penv/bin/pio run -e nodemcu_32s_wireless -t upload
```

## 5. Extra reminders on macOS

- The first `PlatformIO` and toolchain preparation step still needs a stable network connection
- In the repo workflow, do not close the terminal window that started the local service
- If no serial port appears, first suspect the cable, driver, or board variance

If you still need more troubleshooting, see [Troubleshooting](troubleshooting.md).
