import type { ServerEvent } from '@orquestador/protocol';

type Listener = (event: ServerEvent) => void;

/** Bus de eventos del motor hacia la UI. */
export class EventBus {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: ServerEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
