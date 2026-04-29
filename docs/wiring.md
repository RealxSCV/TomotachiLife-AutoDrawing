# Wiring

This repository now uses a classic ESP32 wireless route as the default hardware path:

- `ESP32-WROOM-32` / `ESP-32S` for Mac-to-device serial plus current Bluetooth Classic controller output

## Recommended connections for the current workflow

- Mac to ESP32: USB cable for flashing and serial command transport
- ESP32 to Switch: Bluetooth Classic pairing and controller transport during drawing

## Important note

The board you bought uses a `CP2102` USB-to-UART bridge. On macOS this appears as a serial device once the driver path is available, which is exactly what the desktop CLI expects for command upload and ACK handling.

## Current recommended workflow

1. Flash the firmware under `firmware/esp32`
2. Keep the board connected to your Mac through USB serial
3. Open the local Web UI
4. Use the `手柄测试` page to pair with Switch and confirm button input
5. Use the `脚本生成` page to send drawing commands through the ACK serial path
6. Observe the logs if either the serial path or Bluetooth path becomes unstable
