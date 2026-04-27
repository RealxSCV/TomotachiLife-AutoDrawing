#pragma once

#include <Arduino.h>

#include "controller_transport.h"

class SwitchController {
 public:
  explicit SwitchController(ControllerTransport &transport);

  void begin();
  void moveHome();
  void moveCursor(int dx, int dy);
  void drawStroke();
  void pressButton(ControllerButton button);
  void pressButtons(uint32_t buttonsMask);
  void selectColor(int index);
  bool resetBluetooth();
  void pause();
  void resume();
  void end();
  void printTransportStatus(Print &output) const;
  const char *transportName() const;

 private:
  ControllerTransport &transport_;
  bool paused_ = false;

  void waitUntilReady() const;
};
