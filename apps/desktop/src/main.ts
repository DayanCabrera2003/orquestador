// Proceso principal: ventana, ciclo de vida del motor, protocolo de la interfaz y actualizaciones.
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
  utilityProcess,
  type UtilityProcess,
} from 'electron';
import electronUpdater from 'electron-updater';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ORIGIN, ENGINE_CONFIG_ENV, type EngineConfig, type EngineMessage } from './config';

const DEV_RENDERER_URL = process.env.ORQ_RENDERER_URL;
const SCHEME = 'app';

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let window: BrowserWindow | null = null;
let engine: UtilityProcess | null = null;
let engineConfig: EngineConfig | null = null;
let enginePort = 0;
let quitting = false;

const rendererDir = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'renderer')
    : join(import.meta.dirname, '..', '..', 'web', 'dist');

/** CLI del agente que trae el SDK; si no está, se usa la del sistema. */
function agentCommand(): string {
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  try {
    const resolved = createRequire(import.meta.url).resolve(
      `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/${exe}`,
    );
    return resolved.replace(`app.asar${sep}`, `app.asar.unpacked${sep}`);
  } catch {
    return 'claude';
  }
}

function startEngine(): Promise<number> {
  const userData = app.getPath('userData');
  const logs = join(userData, 'logs');
  mkdirSync(logs, { recursive: true });
  engineConfig ??= {
    databasePath: join(userData, 'orquestador.db'),
    worktreesDir: join(userData, 'worktrees'),
    token: randomBytes(32).toString('hex'),
    allowedOrigins: [APP_ORIGIN, ...(DEV_RENDERER_URL ? [new URL(DEV_RENDERER_URL).origin] : [])],
    agentCommand: agentCommand(),
  };

  const child = utilityProcess.fork(join(import.meta.dirname, 'engine.mjs'), [], {
    serviceName: 'Orquestador Engine',
    stdio: 'pipe',
    env: { ...process.env, [ENGINE_CONFIG_ENV]: JSON.stringify(engineConfig) },
  });
  const log = createWriteStream(join(logs, 'engine.log'), { flags: 'a' });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  engine = child;

  return new Promise((resolve, reject) => {
    child.on('message', (message: EngineMessage) => {
      if (message.type === 'ready') resolve(message.port);
      else reject(new Error(message.message));
    });
    child.on('exit', (code) => {
      if (engine === child) engine = null;
      if (quitting) return;
      // El motor se cayó: se reinicia y la ventana se recarga con el puerto nuevo.
      log.write(`\n[orquestador] el motor terminó con código ${String(code)}; reiniciando\n`);
      void startEngine().then((port) => {
        enginePort = port;
        window?.reload();
      });
    });
  });
}

function registerProtocol(): void {
  const root = rendererDir();
  const csp = [
    "default-src 'self'",
    `connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
  ].join('; ');
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const file = normalize(
      join(root, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)),
    );
    if (!file.startsWith(root)) return new Response('Prohibido', { status: 403 });
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', csp);
    return new Response(response.body, { status: response.status, headers });
  });
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'Orquestador',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.once('ready-to-show', () => window?.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith(`${APP_ORIGIN}/`) ||
      (DEV_RENDERER_URL !== undefined && url.startsWith(DEV_RENDERER_URL));
    if (!allowed) event.preventDefault();
  });
  window.on('closed', () => {
    window = null;
  });
  void window.loadURL(DEV_RENDERER_URL ?? `${APP_ORIGIN}/index.html`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });

  ipcMain.on('orq:config', (event) => {
    event.returnValue = {
      port: enginePort,
      token: engineConfig?.token ?? '',
      version: app.getVersion(),
      platform: process.platform,
    };
  });
  ipcMain.handle('orq:pick-directory', async () => {
    const options = { properties: ['openDirectory' as const] };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  void app.whenReady().then(async () => {
    registerProtocol();
    try {
      enginePort = await startEngine();
    } catch (e) {
      dialog.showErrorBox(
        'Orquestador',
        `No se pudo iniciar el motor: ${e instanceof Error ? e.message : String(e)}`,
      );
      app.quit();
      return;
    }
    createWindow();
    if (app.isPackaged) void electronUpdater.autoUpdater.checkForUpdatesAndNotify();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && enginePort) createWindow();
  });

  app.on('window-all-closed', () => {
    // En macOS la app sigue abierta al cerrar la última ventana.
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    engine?.postMessage({ type: 'shutdown' });
  });
}
