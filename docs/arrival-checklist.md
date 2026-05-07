# 开发板到手检查清单

[English](en/arrival-checklist.md)

这份清单适合在你的 `ESP32-WROOM-32 / ESP-32S` 开发板刚到手时使用。

## 路径说明

- 下面出现的串口路径都只是示例
- 你需要把 `/dev/cu.SLAB_USBtoUART` 这类路径替换成你自己机器上的实际串口
- 如果 `pio` 已经在你的 shell `PATH` 里，可以直接用 `pio ...`；否则继续使用完整路径 `~/.platformio/penv/bin/pio ...`

## 1. 先接上开发板

- 用一根支持数据传输的 USB-C 线把开发板连到 Mac
- 运行 `npm run dev -- --list-ports`
- 确认能看到类似 `/dev/cu.SLAB_USBtoUART` 或 `/dev/cu.usbserial-*` 的串口

如果始终看不到串口，请先安装 Silicon Labs 官方 `CP210x VCP` 驱动：
https://www.silabs.com/software-and-tools/usb-to-uart-bridge-vcp-drivers

## 2. 先刷入固件

优先先试通用环境：

```bash
pio run -e esp32dev_wireless -t upload
pio device monitor -b 115200
```

说明：

- 现在第一次编译会比以前更慢，因为 `esp32dev_wireless` 已经改成使用 `Arduino + ESP-IDF`
- 这样做是为了让固件能链接 `Bluetooth Classic HID` 协议栈

如果你手上的某块兼容板刷写行为更接近 `NodeMCU-32S`，可以改用：

```bash
pio run -e nodemcu_32s_wireless -t upload
pio device monitor -b 115200
```

## 3. 确认启动日志

复位后，串口监视器里应该能看到类似下面的启动行：

```txt
BOOT switch-auto-draw board=esp32-classic transport=classic-bt-hid mock=false
```

这表示：

- 固件已经启动
- 串口链路正常
- 蓝牙传输层已经切到 `Bluetooth Classic HID`

## 4. 运行协议冒烟测试

直接使用仓库自带命令文件：

```bash
npm run dev -- --commands-file ./examples/smoke-test-commands.txt --port <your-serial-port> --send
```

期望结果：

- Mac 端 CLI 会显示命令执行进度
- 开发板会为每条命令返回类似 `OK a1b2c3d4 1` 这种带序号的 ACK
- 串口监视器会在执行 `I` 命令时打印 `INFO transport=classic-bt-hid`
- `I` 命令还会输出 `bt_hid_ready`、`bt_app_registered`、`bt_discoverable` 等蓝牙就绪字段

## 5. 继续做导图测试

如果前面的冒烟测试已经稳定，再继续：

```bash
npm run dev -- --image ./examples/demo.svg --preview ./tmp/demo-preview.png --write-commands ./tmp/demo-commands.txt
```

然后把生成好的命令真正发给开发板：

```bash
npm run dev -- --image ./examples/demo.svg --port <your-serial-port> --send
```

## 6. 这份清单能验证什么

- Mac 到 ESP32 的串口连接
- 命令分帧与 ACK 返回行为
- 暂停 / 继续 / 中断控制链路
- 动作与按键命令的 timing 占位能力
- `Bluetooth Classic HID` 协议栈能否正常拉起并进入可发现状态

它仍然不能单独证明：

- 这块板子已经能稳定连上 `Switch`
- 当前报告格式与配对行为已经完全满足实机要求

当前固件暴露的是一个通用游戏手柄 HID 骨架，`Switch` 侧的真实配对表现和报告时序，仍然需要实机继续验证。
