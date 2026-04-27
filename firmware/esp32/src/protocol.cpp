#include "protocol.h"

namespace {

bool parseTwoInts(const String &value, int &first, int &second) {
  const int firstSpace = value.indexOf(' ');
  if (firstSpace < 0) {
    return false;
  }

  const int secondSpace = value.indexOf(' ', firstSpace + 1);
  if (secondSpace < 0) {
    return false;
  }

  first = value.substring(firstSpace + 1, secondSpace).toInt();
  second = value.substring(secondSpace + 1).toInt();
  return true;
}

bool parseOneInt(const String &value, int &result) {
  const int firstSpace = value.indexOf(' ');
  if (firstSpace < 0) {
    return false;
  }

  result = value.substring(firstSpace + 1).toInt();
  return true;
}

ControllerButton parseButton(const String &line, bool &ok) {
  ok = true;

  if (line == "A") {
    return ControllerButton::A;
  }

  if (line == "B") {
    return ControllerButton::B;
  }

  if (line == "X") {
    return ControllerButton::X;
  }

  if (line == "Y") {
    return ControllerButton::Y;
  }

  if (line == "L") {
    return ControllerButton::L;
  }

  if (line == "R") {
    return ControllerButton::R;
  }

  if (line == "ZL") {
    return ControllerButton::ZL;
  }

  if (line == "ZR") {
    return ControllerButton::ZR;
  }

  if (line == "+" || line == "PLUS") {
    return ControllerButton::Plus;
  }

  if (line == "-" || line == "MINUS") {
    return ControllerButton::Minus;
  }

  if (line == "HOME") {
    return ControllerButton::Home;
  }

  if (line == "CAPTURE" || line == "CAP") {
    return ControllerButton::Capture;
  }

  if (line == "LS" || line == "L3") {
    return ControllerButton::LStick;
  }

  if (line == "RS" || line == "R3") {
    return ControllerButton::RStick;
  }

  if (line == "DUP" || line == "UP") {
    return ControllerButton::DpadUp;
  }

  if (line == "DDOWN" || line == "DOWN") {
    return ControllerButton::DpadDown;
  }

  if (line == "DLEFT" || line == "LEFT") {
    return ControllerButton::DpadLeft;
  }

  if (line == "DRIGHT" || line == "RIGHT") {
    return ControllerButton::DpadRight;
  }

  ok = false;
  return ControllerButton::A;
}

bool parseButtonCommand(
    const String &line, ControllerButton &button, uint32_t &buttonsMask, bool &isCombo) {
  if (!line.startsWith("BTN ")) {
    return false;
  }

  const String token = line.substring(4);

  if (token == "LR" || token == "L+R") {
    buttonsMask =
        controllerButtonMask(ControllerButton::L) | controllerButtonMask(ControllerButton::R);
    isCombo = true;
    return true;
  }

  bool ok = false;
  button = parseButton(token, ok);

  if (!ok) {
    return false;
  }

  buttonsMask = controllerButtonMask(button);
  isCombo = false;
  return true;
}

const char *buttonName(ControllerButton button) {
  switch (button) {
    case ControllerButton::A:
      return "A";
    case ControllerButton::B:
      return "B";
    case ControllerButton::X:
      return "X";
    case ControllerButton::Y:
      return "Y";
    case ControllerButton::L:
      return "L";
    case ControllerButton::R:
      return "R";
    case ControllerButton::ZL:
      return "ZL";
    case ControllerButton::ZR:
      return "ZR";
    case ControllerButton::Plus:
      return "PLUS";
    case ControllerButton::Minus:
      return "MINUS";
    case ControllerButton::Home:
      return "HOME";
    case ControllerButton::Capture:
      return "CAPTURE";
    case ControllerButton::LStick:
      return "LS";
    case ControllerButton::RStick:
      return "RS";
    case ControllerButton::DpadUp:
      return "DUP";
    case ControllerButton::DpadDown:
      return "DDOWN";
    case ControllerButton::DpadLeft:
      return "DLEFT";
    case ControllerButton::DpadRight:
      return "DRIGHT";
    default:
      return "?";
  }
}

}  // namespace

bool executeCommand(const String &line, SwitchController &controller, String &error) {
  if (line.length() == 0) {
    return true;
  }

  if (line == "I") {
    Serial.printf("INFO transport=%s\n", controller.transportName());
    controller.printTransportStatus(Serial);
    return true;
  }

  if (line == "BT RESET") {
    if (!controller.resetBluetooth()) {
      error = "bt reset failed";
      return false;
    }

    Serial.println("INFO action=bt-reset");
    return true;
  }

  if (line == "H") {
    controller.moveHome();
    Serial.println("INFO action=home");
    return true;
  }

  if (line == "P") {
    controller.drawStroke();
    Serial.println("INFO action=draw button=A");
    return true;
  }

  if (line == "LR" || line == "L+R") {
    controller.pressButtons(controllerButtonMask(ControllerButton::L) |
                            controllerButtonMask(ControllerButton::R));
    Serial.println("INFO action=combo name=L+R");
    return true;
  }

  ControllerButton commandButton = ControllerButton::A;
  uint32_t commandButtonsMask = 0;
  bool isComboCommand = false;

  if (parseButtonCommand(line, commandButton, commandButtonsMask, isComboCommand)) {
    if (isComboCommand) {
      controller.pressButtons(commandButtonsMask);
      Serial.println("INFO action=combo name=L+R");
      return true;
    }

    controller.pressButton(commandButton);
    Serial.printf("INFO action=button name=%s\n", buttonName(commandButton));
    return true;
  }

  if (line == "S") {
    controller.pause();
    Serial.println("INFO action=pause");
    return true;
  }

  if (line == "R") {
    controller.resume();
    Serial.println("INFO action=resume");
    return true;
  }

  if (line == "E") {
    controller.end();
    Serial.println("INFO action=end");
    return true;
  }

  if (line.startsWith("M ")) {
    int dx = 0;
    int dy = 0;

    if (!parseTwoInts(line, dx, dy)) {
      error = "invalid move";
      return false;
    }

    controller.moveCursor(dx, dy);
    Serial.printf("INFO action=move dx=%d dy=%d\n", dx, dy);
    return true;
  }

  if (line.startsWith("C ")) {
    int index = 0;

    if (!parseOneInt(line, index)) {
      error = "invalid color";
      return false;
    }

    controller.selectColor(index);
    Serial.printf("INFO action=color index=%d\n", index);
    return true;
  }

  if (line.startsWith("W ")) {
    int delayMs = 0;

    if (!parseOneInt(line, delayMs)) {
      error = "invalid wait";
      return false;
    }

    delay(delayMs);
    Serial.printf("INFO action=wait ms=%d\n", delayMs);
    return true;
  }

  bool ok = false;
  const ControllerButton button = parseButton(line, ok);

  if (ok) {
    controller.pressButton(button);
    Serial.printf("INFO action=button name=%s\n", buttonName(button));
    return true;
  }

  error = "unknown command";
  return false;
}
