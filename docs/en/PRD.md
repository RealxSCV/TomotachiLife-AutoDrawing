# Friend Maker PRD

[简体中文](../PRD.md)

Version: v0.2
Status: Active Alpha
Updated: 2026-04-29

## 1. Product overview

`Friend Maker` is an automatic drawing tool built around `macOS / Windows + ESP32-WROOM-32 / ESP-32S + Nintendo Switch`.

The user imports an image on the computer, adjusts drawing parameters, and generates an action script. An ESP32 then emulates a `Bluetooth Classic` Switch Pro Controller and draws the image onto the `Tomodachi Life` canvas in a stable and repeatable way.

The current version is no longer just a script-generation prototype. It is now a usable local web workspace with these four main stages:

- `Script Studio`
- `Firmware Flash`
- `Controller Test`
- `Timing Tune / Benchmark`

The current product still follows three guiding principles:

- stability before speed
- repeatability before flashy automation
- debuggability before autonomy

## 2. One-line summary of the current version

As of `2026-04-29`, the repository already supports one testable closed loop:

`Firmware Flash -> Controller Test -> Timing Tune / Benchmark -> Script Studio -> serial ACK transport -> ESP32 Bluetooth controller output -> Switch canvas drawing`

The recommended first-run order is fixed as:

1. `Firmware Flash`
2. `Controller Test`
3. `Timing Tune / Benchmark`
4. `Script Studio`

## 3. Problems the product is solving right now

Manually recreating an image inside the Switch drawing canvas has several practical problems:

- too much repetitive work
- cursor movement drifts easily and ruins the full picture
- color switching is tedious and easy to mess up
- the same image is hard to reproduce consistently
- once the hardware chain breaks, it is hard to tell where the failure happened

The current goal is not to solve fully automatic, high-fidelity multicolor drawing for arbitrary images in one step. The current goal is to make this narrower promise stable first:

`Users can finish flashing, controller setup, image import, and real drawing inside one local workspace, and every stage stays observable and debuggable.`

## 4. Target users

### 4.1 Core users

- maker-style users who can tolerate dev boards, serial ports, and basic command-line work
- early testers who want to recreate pixel art, character art, or logo-like images inside the Switch drawing page
- users who are willing to start from fixed assumptions and tune parameters gradually

### 4.2 Non-target users

- users who expect plug-and-play consumer behavior
- users who do not want to touch boards, firmware, or serial tooling
- users who expect arbitrary games, arbitrary canvases, and arbitrary color spaces to be auto-adapted

## 5. Current version goals

### 5.1 Product goals

- complete the four-page web UI workflow
- let flashing, connection testing, and drawing all happen inside one local system
- move `mono drawing`, `official palette drawing`, and `custom multicolor` into a state that is testable, repeatable, and debuggable

### 5.2 Success criteria for the current alpha

The current alpha should satisfy at least the following:

- users can import `PNG / JPG / SVG`
- users can view previews, statistics, and actual command scripts
- users can flash ESP32 firmware through local `PlatformIO` from the web UI
- users can connect the controller, reset Bluetooth, and run button/stick tests from the web UI
- users can tune `inputDelay / buttonPressDuration` and run loopback timing tests from the web UI
- users can send scripts over serial in `ACK` mode and observe the process in logs
- users can finish mono, official-palette, or custom-multicolor drawing under the current fixed assumptions

## 6. Capabilities already completed

### 6.1 Script Studio

- fixed `256x256` script-coordinate canvas
- six brush sizes: `1 / 3 / 7 / 13 / 19 / 27`
- `mono drawing`
- `official palette drawing`
- `custom multicolor`
- official-palette quantization levels: `8 / 16 / 32 / 64 / 84`
- custom-multicolor quantization levels: `8 / 9 / 16 / 18 / 24 / 32 / 64 / 84 / 128`
- image scale and X/Y offset
- automatic background removal
- preview guides
- official palette preview and used-color highlighting
- copy, download, and execute command scripts
- one-click drawing start
- pause / resume / stop / forced recovery-state reset
- fixed-height scrolling execution log

### 6.2 Firmware Flash page

- automatic local `PlatformIO` detection
- firmware environment and serial-port selection
- direct compile-and-flash flow inside the web UI
- result cards for flash outcomes
- full flash logs

### 6.3 Controller Test page

- refresh serial ports
- connect controller
- reset controller Bluetooth
- D-pad / stick / button step tests
- custom test command sending
- display discovery, authentication, connection, pairing, and ready-to-send states
- display recent host, transport layer, initialization steps, and errors
- fixed-height scrolling test log

### 6.4 Timing Tune / Benchmark page

- adjust `inputDelay` and `buttonPressDuration`
- persist timing values locally
- quick D-pad / button taps
- loopback benchmark and result cards
- sync timing into the final drawing script through `CFG INPUT`

### 6.5 Firmware and protocol

- text-protocol parsing
- serial ACK transport path
- base commands such as `I / H / M / P / A / B / X / Y / C / W / S / R / E`
- `BC RESET` and official-palette slot configuration commands
- Bluetooth controller state reading
- test commands such as `TAP` and `HOLD`

## 7. Scope and non-goals

### 7.1 In-scope for the current version

- platform:
  - full test path on `macOS`
  - manual install and manual launch on `Windows`
- local form factor: `TypeScript CLI + Local Web UI`
- hardware mainline: `ESP32-WROOM-32 / ESP-32S`
- controller path: `ESP32 Bluetooth Classic -> Switch`
- target scene: the Switch version of the `Tomodachi Life` drawing page

### 7.2 Explicit non-goals for now

- Electron desktop packaging
- Linux validation support
- automatic visual calibration
- exact custom-color auto tuning
- automatic recognition of arbitrary game UIs
- detached offline execution after uploading a task

## 8. Key user flows

### 8.1 First-run flow

1. Launch the local web UI
2. Flash the recommended firmware from `Firmware Flash`
3. Complete Bluetooth connection and button validation in `Controller Test`
4. Return to `Script Studio`, import an image, and adjust parameters
5. Generate preview and commands first
6. Start the real drawing only after the result looks correct

### 8.2 Day-to-day drawing flow

1. Open the web UI
2. Confirm controller status quickly
3. Import a new image
4. Choose `mono drawing`, `official palette drawing`, or `custom multicolor`
5. Confirm brush size, center-start assumption, and official-palette slot assumptions
6. Start drawing and watch execution progress in the log

## 9. Technical and scene assumptions

The current mainline is built on these fixed assumptions:

- the target canvas is modeled as `256x256` script coordinates
- before drawing starts, the brush / cursor is already at the center of the canvas
- the brush size inside `Switch` has already been changed manually to match the web UI
- using the square brush is recommended
- `A` performs drawing
- the D-pad performs one-cell movement
- if `official palette drawing` is used, the game's right-side `9` palette slots are still at their default colors

These are not the final product shape. They are the current engineering boundaries chosen for stability.

## 10. Current limitations

- the workflow still depends on fixed scene assumptions instead of full auto calibration
- the official `7x12` palette is still being calibrated
- `custom multicolor` is already available as a formal feature, but color fidelity and long-run stability still need more work
- drawing quality is still affected by in-game brush behavior, starting position, and connection stability
- Windows still lacks a one-click launcher

## 11. Milestone status

### Phase 0: local workspace established

Status: completed

- the four-page local web UI structure is in place
- documentation, test flows, and example assets are in place

### Phase 1: serial transport and script execution

Status: completed

- image preview, command generation, and serial ACK transport are connected
- logs and pause / resume / stop controls are connected

### Phase 2: firmware flashing inside the web UI

Status: completed

- local `PlatformIO` can be invoked from the web UI
- flash results and logs are visible

### Phase 3: Bluetooth connection and controller testing

Status: completed to the usable-test stage

- controller connection, state reading, and step tests are connected
- connection stability and timing calibration still need more work

### Phase 4: full drawing loop

Status: entered alpha trial

- `Firmware Flash -> Controller Test -> Timing Tune / Benchmark -> Script Studio -> Start Drawing` is now runnable
- mono and official-palette mainline flows are both testable

### Phase 5: later optimization stage

Status: not started

- Electron packaging
- visual calibration
- offline execution
- more stable color and position calibration

## 12. Acceptance criteria for the current stage

The current stage should be accepted against these criteria:

- `npm run check` and `npm run build` pass
- the web UI starts normally and shows the four pages
- `Firmware Flash` can detect `PlatformIO` and serial ports
- `Controller Test` can show connection state and send test commands
- `Script Studio` can generate preview, script, and execution statistics
- during real execution, logs stay observable and commands advance through ACK

## 13. Matching implementation in the repository

- Web UI service: `apps/desktop/src/web/server.ts`
- Web UI interaction: `apps/desktop/src/web/static/app.js`
- Web UI page: `apps/desktop/src/web/static/index.html`
- image processing: `apps/desktop/src/image/*`
- path generation: `apps/desktop/src/path/scanline.ts`
- serial sending: `apps/desktop/src/serial/sender.ts`
- firmware implementation: `firmware/esp32/src/*`
- trial guide: `user-trial-guide.md`

## 14. Priority for the next stage

1. keep improving Bluetooth connection stability and long-run drawing stability
2. keep calibrating the official `7x12` palette mapping and real-device appearance
3. keep improving execution logs, status prompts, and failure recovery UX
4. improve the Windows trial path and installation experience
5. do not move into Electron packaging until stability is clearly better
