#pragma once

#include "controller_transport.h"

class MockControllerTransport : public ControllerTransport {
 public:
  void begin() override;
  void pressButtons(uint32_t buttonsMask, uint16_t holdMs, uint16_t settleMs) override;
  void moveDirection(int x, int y, uint16_t holdMs, uint16_t settleMs) override;
  bool resetConnection() override;
  void printStatus(Print &output) const override;
  const char *name() const override;
};
