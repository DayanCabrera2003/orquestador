import { ServerEventSchema, type ClientCommand, type ServerEvent } from '@orquestador/protocol';
import { engineConfig } from './config';

type EventListener = (event: ServerEvent) => void;
type StatusListener = (connected: boolean) => void;

/** Conexión WebSocket con el motor. Se reconecta sola con espera creciente. */
export class EngineSocket {
  private socket: WebSocket | undefined;
  private readonly listeners = new Set<EventListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly queue: ClientCommand[] = [];
  private retry = 0;
  private stopped = false;

  connect(): void {
    this.stopped = false;
    const { wsUrl, token } = engineConfig();
    const socket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    this.socket = socket;
    socket.onopen = () => {
      this.retry = 0;
      this.statusListeners.forEach((l) => {
        l(true);
      });
      for (const command of this.queue.splice(0)) socket.send(JSON.stringify(command));
    };
    socket.onmessage = (message: MessageEvent<string>) => {
      const parsed = ServerEventSchema.safeParse(JSON.parse(message.data));
      if (parsed.success)
        this.listeners.forEach((l) => {
          l(parsed.data);
        });
    };
    socket.onclose = () => {
      this.statusListeners.forEach((l) => {
        l(false);
      });
      if (this.stopped) return;
      const delay = Math.min(10_000, 500 * 2 ** this.retry++);
      setTimeout(() => {
        this.connect();
      }, delay);
    };
  }

  close(): void {
    this.stopped = true;
    this.socket?.close();
  }

  /** Envía un comando; si no hay conexión, lo guarda hasta reconectar. */
  send(command: ClientCommand): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(command));
    else this.queue.push(command);
  }

  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}

export const engineSocket = new EngineSocket();
