import "esp-web-tools/dist/web/install-button.js";
import "./styles.css";

interface FirmwareManifest {
  name: string;
  version: string;
  builds: Array<{
    chipFamily: string;
    parts: Array<{
      path: string;
      offset: number;
    }>;
  }>;
  metadata?: {
    boardId?: string;
    desktopReleaseUrl?: string;
    label?: string;
    sha256?: Array<{
      path: string;
      value: string;
    }>;
  };
}

type InstallButtonElement = HTMLElement & {
  manifest?: string;
  showLog?: boolean;
  eraseFirst?: boolean;
};

const els = {
  supportCard: document.getElementById("support-card") as HTMLElement,
  supportPill: document.getElementById("support-pill") as HTMLElement,
  supportTitle: document.getElementById("support-title") as HTMLElement,
  supportDetail: document.getElementById("support-detail") as HTMLElement,
  flashHint: document.getElementById("flash-hint") as HTMLElement,
  desktopDownloadLink: document.getElementById("desktop-download-link") as HTMLAnchorElement,
  desktopStepLabel: document.getElementById("desktop-step-label") as HTMLElement,
  desktopFlowLabel: document.getElementById("desktop-flow-label") as HTMLElement,
  firmwareVersion: document.getElementById("firmware-version") as HTMLElement,
  firmwareBoardLabel: document.getElementById("firmware-board-label") as HTMLElement,
  firmwarePartsList: document.getElementById("firmware-parts-list") as HTMLUListElement,
  firmwareShaList: document.getElementById("firmware-sha-list") as HTMLUListElement,
  firmwareInstallButton: document.getElementById("firmware-install-button") as InstallButtonElement,
};

const fallbackDesktopReleaseUrl = els.desktopDownloadLink.href;

function setCardTone(card: HTMLElement, tone: "idle" | "success" | "warning" | "error"): void {
  card.classList.remove("status-idle", "status-success", "status-warning", "status-error");
  card.classList.add(`status-${tone}`);
}

function formatDesktopLabel(version: string): string {
  return `Friend Maker Desktop v${version}`;
}

function renderBrowserSupport(version?: string): void {
  if ("serial" in navigator && navigator.serial) {
    setCardTone(els.supportCard, "success");
    els.supportPill.textContent = "可用";
    els.supportTitle.textContent = "当前浏览器支持 Web Serial";
    els.supportDetail.textContent = version
      ? `可以直接用这个页面刷入固件。刷完后请下载 ${formatDesktopLabel(version)} 继续连接板子并绘画。`
      : "可以直接用这个页面刷入固件。刷完后请下载 Friend Maker Desktop 继续连接板子并绘画。";
    return;
  }

  setCardTone(els.supportCard, "warning");
  els.supportPill.textContent = "不支持";
  els.supportTitle.textContent = "当前浏览器不支持 Web Serial";
  els.supportDetail.textContent = "请改用桌面版 Chrome 或 Edge 打开这个网站。";
}

function renderDesktopRelease(version: string, desktopReleaseUrl: string): void {
  const desktopLabel = formatDesktopLabel(version);
  els.flashHint.textContent = `如果刷机后串口重新枚举或临时断开，这是正常现象。下一步请下载 ${desktopLabel} 继续使用。`;
  els.desktopDownloadLink.href = desktopReleaseUrl;
  els.desktopDownloadLink.textContent = `下载 ${desktopLabel}`;
  els.desktopStepLabel.textContent = desktopLabel;
  els.desktopFlowLabel.textContent = desktopLabel;
}

function renderManifest(manifest: FirmwareManifest): void {
  els.firmwareVersion.textContent = manifest.version;
  els.firmwareBoardLabel.textContent = manifest.metadata?.label ?? "ESP32-WROOM-32 / ESP-32S";
  els.firmwarePartsList.innerHTML = "";
  els.firmwareShaList.innerHTML = "";

  for (const part of manifest.builds[0]?.parts ?? []) {
    const li = document.createElement("li");
    li.textContent = `${part.path} @ 0x${part.offset.toString(16)}`;
    els.firmwarePartsList.append(li);
  }

  for (const entry of manifest.metadata?.sha256 ?? []) {
    const li = document.createElement("li");
    li.textContent = `${entry.path}: ${entry.value}`;
    els.firmwareShaList.append(li);
  }

  renderDesktopRelease(manifest.version, manifest.metadata?.desktopReleaseUrl ?? fallbackDesktopReleaseUrl);
  renderBrowserSupport(manifest.version);
  els.firmwareInstallButton.manifest = "./firmware/manifest.json";
  els.firmwareInstallButton.showLog = true;
  els.firmwareInstallButton.eraseFirst = false;
}

async function loadManifest(): Promise<void> {
  try {
    const response = await fetch("./firmware/manifest.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = (await response.json()) as FirmwareManifest;
    renderManifest(manifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    els.firmwareVersion.textContent = message;
    els.firmwareBoardLabel.textContent = "-";
    els.firmwarePartsList.innerHTML = "";
    els.firmwareShaList.innerHTML = "";
  }
}

async function bootstrap(): Promise<void> {
  renderBrowserSupport();
  await loadManifest();
}

void bootstrap();
