import type { DesktopApi } from "../shared/ipc";

declare global {
  interface Window {
    deepcode: DesktopApi;
  }
}

export const api: DesktopApi = window.deepcode;
