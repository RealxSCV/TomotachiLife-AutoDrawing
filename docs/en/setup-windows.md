# Windows Notes

[简体中文](../setup-windows.md)

This document only covers `Windows x64`-specific differences.
For the full main flow, start with [Quick Start](user-trial-guide.md).

## 1. Current support scope

- Supported: `Windows 10 / 11 x64`
- Not supported: `Windows ARM64`

Current recommendation:

- Prefer the packaged `Windows x64` desktop app first

## 2. Most common Windows-specific differences during first setup

### 2.1 `winget`

If you want to run `Install Friend Maker.cmd`, it is best to have these available first:

- `winget`
- `App Installer`

If `winget` is missing, install or update `App Installer` from Microsoft Store first.

### 2.2 Serial drivers

`ESP32-WROOM-32 / ESP-32S` boards often expose `COM` ports through these USB-to-serial chips:

1. `CP210x`
2. `CH340 / CH341`

If `PlatformIO` is ready inside the app but no serial port appears, use this order first:

1. Click `Install CP210x Driver (Preferred)` on the `Firmware Flash` page
2. Replug the board
3. Click `Refresh Ports`
4. If the port still does not appear, try `Install CH340/CH341 Driver (Fallback)`

## 3. Extra notes for the repo workflow on Windows

If you run from source, also prepare:

- `Node.js 20+`
- `npm 10+`
- `Python 3`
- `PlatformIO Core 6+`

`Install Friend Maker.cmd` tries to check and install these dependencies automatically, but it only handles:

- dependency installation
- `npm install`
- `npm run check`

After that, you still need to start the UI manually:

```powershell
cd C:\path\to\friendmaker
npm run ui:dev
```

If the main problem is:

- `winget` downloading too slowly
- `Node.js` downloading too slowly
- `npm install` taking too long
- `PlatformIO` or `Python` setup failing

## 4. Manual PlatformIO commands on Windows

If you want to confirm that `PlatformIO` works manually, start with:

```powershell
python -m pip install --user --upgrade platformio
```

If `pio` is not in `PATH`, the full path is usually:

```powershell
$env:USERPROFILE\.platformio\penv\Scripts\pio.exe
```

Example firmware flash command:

```powershell
cd C:\path\to\friendmaker\firmware\esp32
$env:USERPROFILE\.platformio\penv\Scripts\pio.exe run -e esp32dev_wireless -t upload --upload-port COM3
```

## 5. Extra reminders on Windows

- Do not install the project under a Chinese-character path
- The first `PlatformIO` and toolchain preparation step still needs a stable network connection
- If no `COM` port appears, first suspect the cable, driver, or board variance

If you still need more troubleshooting, see [Troubleshooting](troubleshooting.md).
