interface SerialPortRequestOptions {
  filters?: Array<{
    usbVendorId?: number;
    usbProductId?: number;
  }>;
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<unknown>;
  getPorts(): Promise<unknown[]>;
}

interface Navigator {
  serial?: Serial;
}
