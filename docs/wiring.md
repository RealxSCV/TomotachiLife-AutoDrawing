# Wiring

This repository now uses a classic ESP32 wireless route as the default hardware path:

- `ESP32-WROOM-32` / `ESP-32S` for Mac-to-device serial plus future Bluetooth Classic controller output

## Recommended connections for the current MVP

- Mac to ESP32: USB cable for flashing and serial command transport
- ESP32 to Switch: later Bluetooth pairing path, not required for the first serial milestone

## Important note

The board you bought uses a `CP2102` USB-to-UART bridge. On macOS this appears as a serial device once the driver path is available, which is exactly what the desktop CLI expects for command upload and ACK handling.

## MVP workflow

1. Flash the firmware under `firmware/esp32`
2. Connect the board to your Mac
3. Start a dry run on the Mac
4. Run `examples/smoke-test-commands.txt` against the serial port
5. Confirm the board responds with `OK` after each command
6. After the serial path is stable, replace the mock controller layer with Bluetooth Classic gamepad behavior
