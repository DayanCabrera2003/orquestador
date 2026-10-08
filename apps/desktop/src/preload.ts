// Puente mínimo entre la interfaz y el proceso principal. Solo expone datos de conexión y el selector de carpetas.
import { contextBridge, ipcRenderer } from 'electron';

interface BridgeConfig {
  port: number;
  token: string;
  version: string;
  platform: string;
}

const config = ipcRenderer.sendSync('orq:config') as BridgeConfig;

contextBridge.exposeInMainWorld('orquestador', {
  ...config,
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('orq:pick-directory') as Promise<string | null>,
});
