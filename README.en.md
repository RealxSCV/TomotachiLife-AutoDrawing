# Friend Maker

[简体中文](README.md)

![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20x64-black.svg)
![Hardware](https://img.shields.io/badge/hardware-ESP32--WROOM--32%20%7C%20ESP--32S-orange.svg)
![Status](https://img.shields.io/badge/status-alpha-yellow.svg)

<p>
  <a href="docs/media/demo-video.mp4">
    <img src="docs/media/demo-real-device.jpeg" alt="Friend Maker real device demo on Nintendo Switch" width="760" />
  </a>
</p>

<p>
  <img src="docs/media/ui-studio-page.png" alt="Friend Maker studio page for image import, preview, and execution" width="32%" />
  <img src="docs/media/ui-firmware-page.png" alt="Friend Maker firmware flash page with PlatformIO integration" width="32%" />
  <img src="docs/media/ui-controller-page.png" alt="Friend Maker controller test page with connection status and actions" width="32%" />
</p>

`Friend Maker` is a local automatic-drawing workspace for `Nintendo Switch Tomodachi Life`.
It brings `ESP32 firmware flashing`, `controller connection testing`, `input timing tuning`, and `image-to-drawing execution` into one interface. Images are converted into pixel previews and action scripts, then sent through an `ESP32-WROOM-32 / ESP-32S` that emulates `Switch Pro Controller` input.

## What it is

- A local workspace for the current real-device loop
- Designed to connect `ESP32 firmware`, `serial ACK transport`, `Switch controller testing`, and `image-driven drawing` into one usable workflow
- Organized around the current four-page desktop flow: `Firmware Flash`, `Controller Test`, `Timing Tune / Benchmark`, and `Script Studio`

## What it can do now

- Import `PNG / JPG / SVG` images and generate pixel previews, stats, and action scripts
- Support `mono drawing`, `official palette drawing`, and `custom multicolor`
- Support six brush sizes: `1 / 3 / 7 / 13 / 19 / 27`
- Support `256x256` canvas modeling, template cropping, preview guides, and automatic background removal
- Handle `PlatformIO` flashing, serial-port enumeration, Windows driver helper flows, controller tests, and timing adjustments from the same UI
- Preserve recovery sessions for pause, resume, stop, crash, or restart scenarios

## Who it is for

- People who already have a `Nintendo Switch` and an `ESP32-WROOM-32 / ESP-32S` board
- People who want a UI-first end-to-end workflow instead of hand-maintained serial scripts
- People who are okay with the current priority being `input stability` rather than maximum speed

## Before you start

- This is not a `zero-setup`, consumer-style plug-and-play tool
- A first successful run still usually involves `ESP32` flashing, serial-port or driver setup, `Switch` controller pairing, and timing adjustment
- If you have never worked with `ESP32`, `PlatformIO`, or similar device workflows before, follow the docs step by step; first-time environment setup usually needs stable internet access, and you should leave time for setup and debugging

## Recommended way to use it

The public docs support two entry routes. They are parallel at install time, then converge into the same four-page workflow once the app is running:

| Route | Best for | Entry |
| --- | --- | --- |
| `Packaged desktop app` | Fastest first-run path | `macOS .dmg` / `Windows x64 .exe` |
| `Repo-based workflow` | Source-based runs, debugging, and contribution | `npm install` + `npm run ui:dev` + `PlatformIO` |

After startup, use the same flow:

1. `Firmware Flash`: confirm `PlatformIO`, serial port, and firmware target
2. `Controller Test`: pair with `Switch` and verify button / direction behavior
3. `Timing Tune / Benchmark`: adjust `inputDelay` first, then fine-tune `buttonPressDuration`
4. `Script Studio`: import images, review previews, start drawing, and resume from in-page recovery tasks when needed

## Current guidance and limits

- The current mainline officially supports `mono drawing`, `official palette drawing`, and `custom multicolor`
- For a first successful run, it is still safer to start with `mono drawing` or structurally simpler images
- The current system models the drawing flow as `256x256` and `start from canvas center`
- Stability still matters more than speed
- Some `ESP32`-compatible boards still vary in controller-link quality, so frequent disconnects or ghost inputs may also require checking cable quality, power delivery, and board variance
- A cleaner Bluetooth environment with fewer nearby active devices is usually better for stability
- Some boards also become less stable after heating up during longer runs, so cooling them down can help

## Platform and hardware support

### Platforms

- Packaged desktop app supported: `macOS`
- Packaged desktop app supported: `Windows x64`
- Not supported: `Windows ARM64`
- Not officially supported yet: `Linux`

### Hardware

- Recommended boards: `ESP32-WROOM-32 / ESP-32S`
- Common compatible labels: `ESP32 DevKitC`, `NodeMCU-32S`
- Prefer boards with built-in `USB` serial for direct flashing
- `ESP32-C3 / ESP32-S3 / ESP32-C6` are not the current recommended mainline path
- Use a USB cable that supports data transfer

## Quick start

### Route A: packaged desktop app

- `macOS`: install the `.dmg`, then launch `Friend Maker`
- `Windows x64`: run the `.exe` installer, then launch `Friend Maker`
- On first entry to `Firmware Flash`, click `Prepare PlatformIO` if it is missing
- The first toolchain and dependency preparation step needs a `stable network connection`
- If the app says `Python` is missing, allow it to download an app-local runtime for Friend Maker
- On `Windows`, if `PlatformIO` is ready but no serial port appears, try the in-app `CP210x` helper before `CH340/CH341`

### Route B: repo-based workflow

Recommended prerequisites:

- `Node.js 20+`
- `npm 10+`
- `PlatformIO Core 6+`
- working `Python 3` if you install `PlatformIO` manually on `Windows`

Common commands:

```bash
cd /path/to/friendmaker
npm install
npm run check
npm run ui:dev
```

Flash firmware:

```bash
cd /path/to/friendmaker/firmware/esp32
pio run -e esp32dev_wireless -t upload
```

If `pio` is not in `PATH`, use the full path instead:

- `macOS`: `~/.platformio/penv/bin/pio`
- `Windows`: `%USERPROFILE%\.platformio\penv\Scripts\pio.exe`

## English docs

- [Quick Start](docs/en/user-trial-guide.md): first run, installation, flashing, pairing, timing tuning, and first drawing
- [Troubleshooting](docs/en/troubleshooting.md): serial, tooling, flashing, connection stability, ghost inputs, drift, and color mismatch
- [Wiring Notes](docs/en/wiring.md): supported boards, connection layout, cable, and power notes
- [Windows Notes](docs/en/setup-windows.md): Windows-specific driver, `winget`, and `COM`-port notes
- [macOS Notes](docs/en/setup-mac.md): macOS-specific serial, driver, and source-run notes
- [Arrival-Day Checklist](docs/en/arrival-checklist.md): first board check, serial verification, flashing, smoke test, and first image-driven validation
- [Development Manual](docs/en/development-manual.md): current modeling assumptions, color routes, protocol additions, and implementation priorities
- [PRD](docs/en/PRD.md): product goals, scope, milestones, and acceptance criteria

## Current boundaries

- The drawing and recovery flow only supports one restart assumption: re-enter the drawing page and continue from the canvas center
- The main canvas is not modeled as a plane that can reliably reset to the top-left corner
- `Official palette drawing` assumes the game's `9` palette slots still start from their default colors
- `Automatic background removal` is for white, light gray, and checkerboard fake-transparency sources; it is not AI cutout
- Touching the screen or using the controller during drawing can still cause drift

## License and attribution

This repository is licensed under **GPL-3.0-or-later**. See [LICENSE](LICENSE) for the full text.

The Switch Bluetooth compatibility path under `firmware/esp32` borrows from and adapts ideas and code paths from [UARTSwitchCon](https://github.com/nullstalgia/UARTSwitchCon), so the repository follows GPL for license compatibility.

- Original source author: Xiaohongshu creator `惜羽拓麻镇`
- If you publicly repost or mirror this project, it is recommended that you credit `惜羽拓麻镇`
- It is also recommended that you include the original publication link

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zhouxiyu1997/friendmaker&type=Date)](https://star-history.com/#zhouxiyu1997/friendmaker&Date)
