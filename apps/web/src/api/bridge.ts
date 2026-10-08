/** Lo que expone el preload de la app de escritorio. No existe cuando la UI corre en el navegador. */
export interface DesktopBridge {
  port: number;
  token: string;
  version: string;
  platform: 'linux' | 'darwin' | 'win32';
  pickDirectory: () => Promise<string | null>;
}

declare global {
  interface Window {
    orquestador?: DesktopBridge;
  }
}

export const desktop = (): DesktopBridge | undefined => window.orquestador;
