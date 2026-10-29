// Bridge injected by the native shells (desktop/macos and desktop/windows); absent in the web build.
export type DesktopUpdateState = 'downloading' | 'ready' | 'installing' | 'failed';

export interface DesktopUpdateStatus {
  state: DesktopUpdateState;
  message?: string;
}

interface DesktopBridge {
  platform: 'macos' | 'windows';
  installUpdate: (version: string) => unknown;
}

declare global {
  interface Window {
    dbclientDesktop?: DesktopBridge;
  }
}

const UPDATE_EVENT = 'dbclient-desktop-update';

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.dbclientDesktop;
}

export function onDesktopUpdateStatus(listener: (status: DesktopUpdateStatus) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<DesktopUpdateStatus>).detail);
  window.addEventListener(UPDATE_EVENT, handler);
  return () => window.removeEventListener(UPDATE_EVENT, handler);
}
