/// <reference types="vite/client" />

declare module "qrcode" {
  interface QRCodeCreateOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }

  interface QRCodeModuleCount {
    size: number;
    get(row: number, col: number): boolean;
  }

  interface QRCodeData {
    modules: QRCodeModuleCount;
  }

  interface QRCodeToDataURLOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }

  function create(text: string, options?: QRCodeCreateOptions): QRCodeData;
  function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
}
