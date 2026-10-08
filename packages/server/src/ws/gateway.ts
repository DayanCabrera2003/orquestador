import websocket from '@fastify/websocket';
import {
  ClientCommandSchema,
  WS_PATH,
  type ClientCommand,
  type ServerEvent,
} from '@orquestador/protocol';
import type { FastifyInstance } from 'fastify';
import type { EventBus } from '../app/events';

export type CommandHandler = (command: ClientCommand) => Promise<void>;

/** WebSocket: envía todos los eventos del motor y recibe comandos de la UI. */
export async function registerGateway(
  app: FastifyInstance,
  events: EventBus,
  onCommand: CommandHandler,
): Promise<void> {
  await app.register(websocket);
  app.get(WS_PATH, { websocket: true }, (socket) => {
    const send = (event: ServerEvent): void => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
    };
    const unsubscribe = events.subscribe(send);

    socket.on('message', (raw: Buffer) => {
      let data: unknown;
      try {
        data = JSON.parse(raw.toString('utf8'));
      } catch {
        send({ type: 'error', code: 'invalid', message: 'Mensaje no es JSON' });
        return;
      }
      const parsed = ClientCommandSchema.safeParse(data);
      if (!parsed.success) {
        send({ type: 'error', code: 'invalid', message: 'Comando inválido' });
        return;
      }
      onCommand(parsed.data).catch((e: unknown) => {
        app.log.error(e);
        send({
          type: 'error',
          code: 'command-failed',
          message: e instanceof Error ? e.message : String(e),
        });
      });
    });

    socket.on('close', unsubscribe);
  });
}
