#include <Arduino.h>

#include "config.h"
#include "classic_bt_controller_transport.h"
#include "controller.h"
#include "protocol.h"

#if USE_MOCK_CONTROLLER
#include "mock_controller_transport.h"
#endif

namespace {

#if USE_MOCK_CONTROLLER
MockControllerTransport mockTransport;
ControllerTransport &transport = mockTransport;
#else
ClassicBtControllerTransport classicBtTransport;
ControllerTransport &transport = classicBtTransport;
#endif

SwitchController controller(transport);

}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  controller.begin();
  Serial.printf(
      "BOOT %s board=%s transport=%s mock=%s\n",
      FIRMWARE_NAME,
      BOARD_FAMILY,
      controller.transportName(),
      USE_MOCK_CONTROLLER ? "true" : "false");
}

void loop() {
  if (!Serial.available()) {
    delay(2);
    return;
  }

  String line = Serial.readStringUntil('\n');
  line.trim();

  String error;
  const bool ok = executeCommand(line, controller, error);

  if (ok) {
    Serial.println("OK");
    return;
  }

  Serial.print("ERR ");
  Serial.println(error);
}
