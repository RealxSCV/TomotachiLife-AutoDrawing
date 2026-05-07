# Development Manual

[简体中文](../development-manual.md)

Built specifically for the Switch version of `Tomodachi Life`.

Updated: 2026-04-29
Status: active development

## Author notes

- Original source author: Xiaohongshu creator `惜羽拓麻镇`
- The repository currently uses the `GPL-3.0-or-later` license
- If you publicly repost, mirror, or redistribute this project, it is recommended that you credit `惜羽拓麻镇`
- If you publicly repost, mirror, or redistribute this project, it is also recommended that you include the original publication link

## 1. Current objective

The current objective is not to complete fully automatic, high-fidelity multicolor drawing for arbitrary images in one step. The current objective is to make this real-world usage chain stable first:

`Firmware Flash -> Controller Test -> Timing Tune / Benchmark -> web image import -> serial ACK execution -> ESP32 Bluetooth controller output -> stable reproduction on the Switch drawing canvas`

Current priorities:

1. stable Bluetooth connection and long-duration execution
2. stable mono, official-palette, and custom-multicolor drawing
3. keep calibrating color sources and offset assumptions
4. only then move on to more ambitious automation

## 2. Stable capabilities right now

As of the current version, these parts are already verified or basically usable:

- the web UI already covers `Script Studio / Firmware Flash / Controller Test / Timing Tune / Benchmark`
- the web UI can directly invoke `PlatformIO` to compile and flash firmware
- the web UI can directly run controller connection, Bluetooth reset, and button / D-pad / stick tests
- the web UI can directly tune `inputDelay / buttonPressDuration` and run loopback timing tests
- a `256x256` script-coordinate canvas
- six brush sizes: `1 / 3 / 7 / 13 / 19 / 27`
- drawing starts from the center of the canvas after entering the drawing page
- after recovery, re-entering the drawing page is still modeled as starting again from the center
- `A` is used for drawing / confirming a stroke
- the D-pad is used for one-cell movement
- the web UI can import images, generate previews, inspect statistics, and execute commands
- the mono drawing path is already working
- the official-palette drawing path is already integrated through `image-q`
- the custom-multicolor path is already integrated as a formal feature and can write batches into the `9` custom color slots
- official colors are quantized into the `7 x 12` / `84`-color base palette and then mapped into the game's right-side `9` palette slots
- automatic background removal, preview guides, and official-palette previews are already integrated
- execution logs, flash logs, and test logs are all observable in the web UI
- `inputDelay` currently behaves more like a stability knob, while `buttonPressDuration` behaves more like an input-strength knob
- recovery tasks are persisted to disk after pause, stop, or abnormal exit; if the app exits while paused, that task is converted into a recoverable task on the next launch
- custom multicolor is already shipped as a formal feature, but color fidelity and long-run stability still need more work
- ESP32 already supports the base serial protocol
- ESP32 already supports the ACK execution path required by the web UI drawing flow
- ESP32 already supports the `TAP <BUTTON> <COUNT>` test command
- ESP32 already supports the `HOLD <BUTTON> <MS>` test command

## 3. Current modeling of the drawing page

The current target drawing page is modeled with these fixed rules:

- after entering the drawing page, the cursor is at the center of the main canvas
- there is currently no reliable reset semantic that can always move the main canvas cursor back to the top-left corner
- because of that, the recovery flow must also assume that the user re-enters the drawing page and starts again from the canvas center
- the current tool is the brush
- `A` is used for drawing
- the D-pad moves one cell per action
- the canvas is handled as `256x256` script coordinates

That means the current mainline for `Script Studio` is:

- fixed `256x256`
- fixed center-start assumption
- three formal routes: mono, official-palette, and custom-multicolor

Important distinction:

- if the docs mention "reset to top-left" or "top-left start", that does not refer to the main canvas by default
- those descriptions only apply to internal navigation modeling in color lists, the base-color page, or the custom-color edit page

## 4. Multicolor split

There are currently two possible multicolor routes.

### Route A: base colors

This is the current recommended mainline.

Known facts:

- the base colors are the system default palette
- the base color area is `7 rows x 12 columns`
- there are `84` directly selectable base colors

Advantages of this route:

- the color set is limited
- it does not require precise tuning inside the custom-color edit page
- it is more suitable for open-loop control
- it is easier to stabilize for automated drawing

The long-term plan for this route should be:

1. record the complete `7 x 12` base color table
2. define a fixed `row / col` for each color
3. quantize input images into these `84` colors in the web UI
4. let ESP32 only open the color page and move to the correct cell

Current conclusion:

`base colors` are the recommended mainline path for future multicolor drawing.

Currently implemented design:

- the web UI now includes `official palette drawing`
- official palette drawing quantizes the input image into `84` base colors
- the script layer now has the `BC <slot> <row> <col>` command
- the firmware configures the 9 palette slots through `slot -> base-color page row/col`
- the current strategy no longer tries to "reset to top-left"; instead, it assumes all 9 slots begin from the game's default colors and then tracks each slot's current `row/col`, moving in normal four directions to reach the target
- the script starts with `BC RESET` to reset the firmware's internal slot-tracking state back to the default-slot assumption
- `BC RESET` only resets palette-slot tracking state; it does not mean the main canvas cursor is reset to top-left
- after moving to the target cell on the base-color page, pressing `A` returns directly to the canvas, so official-palette slot configuration no longer sends extra `B / A / B`

### Route B: custom colors

This is the route already integrated formally as `custom multicolor`.

Known facts:

- the color page has two tabs: `base colors` and `custom colors`
- pressing `Y` on the drawing page opens the palette list
- the palette list has `9` palette slots
- there are other non-palette items above the list
- pressing `Y` again enters the palette edit page
- inside the edit page, `R` switches to the `custom colors` tab and `L` switches to the `base colors` tab
- `B` exits the palette page or edit page
- `A` selects the current palette slot
- inside the edit page:
  - `ZL / ZR` control the hue bar at the bottom
  - the large block above is a two-dimensional color area
  - the direction semantics for `M 1 0 / M -1 0 / M 0 -1 / M 0 1` are already confirmed

Why custom-color automation still needs more work:

- the displacement relationship between `TAP DLEFT 20` and `TAP DLEFT 40` is still unstable
- the number of taps and the actual cursor displacement are not strictly linear
- long holds and taps do not behave the same; holds can accelerate
- without visual feedback, there is no guarantee that `#RRGGBB` lands precisely on the intended location

Current conclusion:

`custom color auto tuning` is already connected as a formal part of `custom multicolor`, but both color precision and stability still need more work.

## 5. Confirmed facts about the custom-color page

Even though auto color editing is already connected, these confirmed facts still need to be kept because they are part of future optimization work.

### 5.1 Palette list

- `Y` opens the palette list
- repeatedly pressing `Down` can stably reach the bottom
- there are `9` palette slots between the bottom and the top

This means the stable selection strategy for the palette list should be:

1. open the list
2. move all the way down to the bottom
3. move back upward to the target slot

### 5.2 Direction semantics in the edit page

Confirmed:

- in the large color block above:
  - `M 1 0` moves right
  - `M -1 0` moves left
  - `M 0 -1` moves up
  - `M 0 1` moves down
- in the hue bar below:
  - `ZL` moves left
  - `ZR` moves right

### 5.3 Reset strategy in the edit page

Confirmed:

- after entering the edit page in the custom-color flow, pressing `R` first is required to land on the correct custom-color tab
- after entering the edit page in the official-color flow, pressing `L` first is required to land on the correct base-color tab
- diagonal movement is not stable
- it is more reasonable to reset vertically first, then horizontally, then reset the hue bar
- the current custom-color experiment branch now prefers testing the `top-left start` assumption
- one currently stable reset parameter set is: push up `1500ms`, push left `3000ms`, and hold `ZL` for `2500ms`

Recommended reset order:

1. reset upward
2. reset leftward
3. hold `ZL` to the left edge of the hue bar

### 5.4 Range exploration results

Current observed behavior:

- the horizontal range in the large color block is obviously long
- the vertical range is about half the same order of magnitude as the horizontal one
- measuring the hue bar with `HOLD` time is unreliable because a long hold may accelerate
- based on current real-device testing, the custom-color edit page can be approximated as:
  - hue around `200` steps
  - saturation around `213` steps
  - brightness around `112` steps
- the hue forward direction under `ZR` is opposite to the usual increasing `HSV hue` direction, so conversion needs a reverse mapping
- after resetting to top-left, the bright end is closer to the starting point; lowering brightness requires moving downward, not upward

Current conclusion:

If custom-color automation is pushed further later, it must:

- prioritize `TAP` counts
- stop using raw `HOLD` duration as a direct color-coordinate conversion

## 6. Current protocol additions

In addition to the original drawing commands, the protocol now includes these test commands.

### 6.1 `TAP`

Format:

```txt
TAP <BUTTON> <COUNT>
```

Examples:

```txt
TAP DRIGHT 216
TAP DLEFT 110
TAP ZR 20
```

Meaning:

- tap a button repeatedly for a specified count
- this is a discrete step command
- it is suitable for calibrating step counts in the edit page or hue bar

### 6.2 `HOLD`

Format:

```txt
HOLD <BUTTON> <MS>
```

Examples:

```txt
HOLD ZL 10000
HOLD ZR 2000
```

Meaning:

- hold a button for a specified number of milliseconds
- suitable only for rough range observation
- not suitable as the final basis for precise color tuning

### 6.3 `STICK`

Format:

```txt
STICK <X> <Y> <MS>
```

Rules:

- `X` can only be `-1 / 0 / 1`
- `Y` can only be `-1 / 0 / 1`
- they cannot both be `0 0`
- `MS` is the duration, from `1` to `60000`

Direction convention:

- `STICK 0 -1 <MS>`: left stick upward
- `STICK 0 1 <MS>`: left stick downward
- `STICK -1 0 <MS>`: left stick left
- `STICK 1 0 <MS>`: left stick right

Examples:

```txt
STICK 0 -1 1500
STICK -1 0 3000
HOLD ZL 2500
```

Meaning:

- push the left stick toward a direction and keep holding for a duration
- suitable for directly testing simulated stick reset behavior in the custom-color edit page
- this is a raw input command with no position calibration

## 7. Current strategy decisions

The current recommendations should be fixed clearly as:

### 7.1 Mono

Continue using it as the mainline development and validation route.

### 7.2 Multicolor

Prioritize the `base colors 7x12` route.

### 7.3 Custom colors

Already included as one of the formal automatic-drawing capabilities, but still needs more optimization in color precision and stability.

## 8. Suggested next development order

1. keep improving Bluetooth connection stability and long-duration drawing stability
2. keep calibrating the `7 x 12` official palette mapping and real-device appearance
3. keep improving logs, status cards, and recovery prompts
4. keep improving the Windows trial path and installation instructions
5. keep improving the stability and color fidelity of custom-color auto tuning

## 9. Important reminder

At the current stage, do not keep investing effort into "precise automatic custom-color restoration from hex values" for very clear reasons:

- open-loop input is still unstable
- tap displacement is not linear
- long holds accelerate
- without visual feedback, precise reproduction cannot be guaranteed

So the practical conclusion is:

`base colors` are currently the most realistic, most engineering-friendly, and easiest-to-stabilize multicolor route.
