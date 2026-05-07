# Wiring Notes

[简体中文](../wiring.md)

This document only covers the hardware, connection layout, and practical notes required by the current public mainline flow.

## 1. Recommended boards

Recommended mainline boards:

- `ESP32-WROOM-32`
- `ESP-32S`

Common compatible labels:

- `ESP32 DevKitC`
- `NodeMCU-32S`

Recommendations:

- Pick boards with onboard `USB` serial that can be flashed directly
- Prefer boards with stable build quality and stable power delivery

Not currently recommended as the mainline path:

- `ESP32-C3`
- `ESP32-S3`
- `ESP32-C6`

## 2. Connection layout

The current mainline connection path is:

```text
Computer
  -> USB data cable
  -> ESP32 development board
  -> Bluetooth Classic
  -> Nintendo Switch
```

Inside this project, that means:

- `Computer -> ESP32`: flash firmware, send commands over serial, receive ACKs, and inspect logs
- `ESP32 -> Switch`: emulate `Switch Pro Controller` input

## 3. USB serial requirements

Please confirm:

- The USB cable supports `data transfer`, not just charging
- The system can see a serial port after the board is plugged in

Common examples:

- On `Windows`, port names often look like `COM3`, `COM5`, or `COM7`
- On `macOS`, common names include `/dev/cu.SLAB_USBtoUART`, `/dev/cu.usbserial-*`, or similar

If no serial port ever appears:

- Try another data-capable cable
- Replug the board
- Confirm that the required driver is installed

## 4. Switch-side connection

The current mainline depends on:

- `ESP32` establishing a controller link to `Switch` through `Bluetooth Classic`
- using the `Controller Test` page to run `Connect Controller`, `Reset Controller Bluetooth`, and step-by-step action tests

During first pairing, open this menu on the `Switch`:

`Controllers -> Change Grip/Order`

## 5. Power and cable reminders

All of the following can directly affect connection stability:

- unstable cable quality
- insufficient USB power delivery
- board-to-board build variance
- too many nearby active Bluetooth devices
- board temperature rising during longer runs

If you see any of the following, also inspect power and cable quality:

- the controller link disconnects easily
- step tests show ghost inputs or sticky inputs
- longer drawing sessions drift more and more

Additional suggestions:

- Keep the Bluetooth environment as clean as possible
- If the board is already hot, let it cool down before longer runs

## 6. Minimum first-run checklist

1. The board belongs to the `ESP32-WROOM-32 / ESP-32S` mainline range
2. The USB cable supports data transfer
3. The computer can see a serial port
4. Firmware can be flashed successfully
5. `Switch` controller pairing tests can complete

If you are already blocked on a concrete problem, jump to [Troubleshooting](troubleshooting.md).
