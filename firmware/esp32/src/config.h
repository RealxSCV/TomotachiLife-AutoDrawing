#pragma once

#include <Arduino.h>

constexpr uint32_t SERIAL_BAUD_RATE = 115200;
constexpr uint16_t HOME_DURATION_MS = 1500;
constexpr uint16_t CELL_MOVE_DURATION_MS = 80;
constexpr uint16_t INPUT_DELAY_MS = 40;
constexpr uint16_t BUTTON_PRESS_DURATION_MS = 60;
constexpr char FIRMWARE_NAME[] = "switch-auto-draw";
constexpr char BOARD_FAMILY[] = "esp32-classic";
constexpr char BT_DEVICE_NAME[] = "Pro Controller";
constexpr char BT_DEVICE_PROVIDER[] = "Nintendo";
constexpr char BT_DEVICE_DESCRIPTION[] = "Gamepad";
constexpr uint8_t BT_PAIR_PIN_LENGTH = 4;
constexpr char BT_PAIR_PIN[] = "1234";
constexpr uint8_t GAMEPAD_REPORT_ID = 1;

#if defined(SWITCH_AUTO_DRAW_USE_CLASSIC_BT)
constexpr char CONTROL_TRANSPORT[] = "classic-bt-uartswitchcon";
constexpr bool USE_MOCK_CONTROLLER = false;
#else
constexpr char CONTROL_TRANSPORT[] = "mock-classic-bt";
constexpr bool USE_MOCK_CONTROLLER = true;
#endif
