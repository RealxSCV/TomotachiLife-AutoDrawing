#include "controller.h"

#include "config.h"

SwitchController::SwitchController(ControllerTransport &transport) : transport_(transport) {}

void SwitchController::begin() { transport_.begin(); }

void SwitchController::waitUntilReady() const {
  while (paused_) {
    delay(10);
  }
}

void SwitchController::moveHome() {
  waitUntilReady();
  transport_.moveDirection(-1, 0, HOME_DURATION_MS, INPUT_DELAY_MS);
  transport_.moveDirection(0, -1, HOME_DURATION_MS, INPUT_DELAY_MS);
}

void SwitchController::moveCursor(int dx, int dy) {
  waitUntilReady();

  const ControllerButton horizontalButton = dx < 0 ? ControllerButton::DpadLeft : ControllerButton::DpadRight;
  const ControllerButton verticalButton = dy < 0 ? ControllerButton::DpadUp : ControllerButton::DpadDown;

  for (int index = 0; index < abs(dx); index += 1) {
    transport_.pressButton(horizontalButton, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
  }

  for (int index = 0; index < abs(dy); index += 1) {
    transport_.pressButton(verticalButton, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
  }
}

void SwitchController::drawStroke() {
  waitUntilReady();
  transport_.pressButton(ControllerButton::A, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
}

void SwitchController::pressButton(ControllerButton button) {
  waitUntilReady();
  transport_.pressButton(button, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
}

void SwitchController::pressButtons(uint32_t buttonsMask) {
  waitUntilReady();
  transport_.pressButtons(buttonsMask, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
}

void SwitchController::selectColor(int index) {
  waitUntilReady();

  // Placeholder timing for MVP firmware. Replace this with game-specific
  // color-menu navigation once the target drawing UI is fixed.
  transport_.pressButton(ControllerButton::X, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);

  for (int step = 0; step < index; step += 1) {
    transport_.pressButton(ControllerButton::DpadRight, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
  }

  transport_.pressButton(ControllerButton::A, BUTTON_PRESS_DURATION_MS, INPUT_DELAY_MS);
  delay(INPUT_DELAY_MS);
}

bool SwitchController::resetBluetooth() {
  waitUntilReady();
  return transport_.resetConnection();
}

void SwitchController::pause() { paused_ = true; }

void SwitchController::resume() { paused_ = false; }

void SwitchController::end() { paused_ = false; }

void SwitchController::printTransportStatus(Print &output) const {
  transport_.printStatus(output);
}

const char *SwitchController::transportName() const { return transport_.name(); }
