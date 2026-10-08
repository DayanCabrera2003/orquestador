import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { AUTH_HEADER } from '@orquestador/protocol';

export interface SecurityOptions {
  token: string;
  /** Orígenes de la UI autorizados, por ejemplo `app://orquestador` o el servidor de Vite en desarrollo. */
  allowedOrigins: readonly string[];
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function hostIsLocal(host: string | undefined): boolean {
  if (!host) return false;
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return name !== undefined && LOCAL_HOSTS.has(name);
}

function deny(req: FastifyRequest, reply: FastifyReply, status: number, code: string): void {
  if (req.headers.upgrade !== undefined) {
    // En un upgrade de WebSocket no hay respuesta HTTP normal: se responde y se cierra el socket.
    reply.hijack();
    req.raw.socket.end(
      `HTTP/1.1 ${String(status)} ${code}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
    return;
  }
  void reply.code(status).send({ code, message: code });
}

/**
 * Protege el canal local: solo hosts locales (contra DNS rebinding), solo orígenes autorizados
 * y token obligatorio en HTTP y en el WebSocket.
 */
export function registerSecurity(
  app: FastifyInstance,
  { token, allowedOrigins }: SecurityOptions,
): void {
  const origins = new Set(allowedOrigins);

  app.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done) => {
    const origin = req.headers.origin;
    if (!hostIsLocal(req.headers.host)) {
      deny(req, reply, 403, 'forbidden');
      return;
    }
    if (origin !== undefined && !origins.has(origin)) {
      deny(req, reply, 403, 'forbidden');
      return;
    }
    if (origin !== undefined) {
      void reply.header('access-control-allow-origin', origin);
      void reply.header('vary', 'origin');
    }
    if (req.method === 'OPTIONS') {
      void reply
        .header('access-control-allow-methods', 'GET, POST, PUT, DELETE')
        .header('access-control-allow-headers', `content-type, ${AUTH_HEADER}`)
        .code(204)
        .send();
      return;
    }
    const url = new URL(req.url, 'http://local');
    const provided = req.headers[AUTH_HEADER] ?? url.searchParams.get('token') ?? '';
    if (typeof provided !== 'string' || !sameToken(provided, token)) {
      deny(req, reply, 401, 'unauthorized');
      return;
    }
    done();
  });
}
