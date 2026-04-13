import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { createHmac } from 'node:crypto';

const MAX_BODY = 2_000_000;
const DEFAULT_REGIONDO_HOST = 'https://api.regiondo.com';

function normalizeRegiondoHost(raw: string | undefined): string {
  const t = (raw ?? '').trim().replace(/\/+$/, '');
  if (!t) return DEFAULT_REGIONDO_HOST;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
}

function signRegiondo(
  publicKey: string,
  privateKey: string,
  queryString: string
): { timestamp: string; hash: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToHash = timestamp + publicKey + queryString;
  const hash = createHmac('sha256', privateKey).update(stringToHash).digest('hex');
  return { timestamp, hash };
}

/**
 * Maps `/api/regiondo/<path>` → `https://api.regiondo.com/v1/<path>`
 */
function regiondoPathFromApiPath(pathname: string): string | null {
  const prefix = '/api/regiondo/';
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
  if (!rest) return null;
  if (rest === 'products') return '/v1/products';
  return `/v1/${rest}`;
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

type NextFn = (err?: unknown) => void;

function regiondoProxyMiddleware(publicKey: string, privateKey: string, regiondoHost: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: NextFn) => {
    if (!req.url?.startsWith('/api/regiondo/')) {
      next();
      return;
    }

    const method = req.method || 'GET';
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    try {
      const incoming = new URL(req.url, 'http://localhost');
      const path = regiondoPathFromApiPath(incoming.pathname);
      if (!path) {
        next();
        return;
      }

      const forward = new URLSearchParams(incoming.search);
      const queryString = forward.toString();
      const regiondoUrl = queryString ? `${regiondoHost}${path}?${queryString}` : `${regiondoHost}${path}`;

      const { timestamp, hash } = signRegiondo(publicKey, privateKey, queryString);

      let bodyBuf: Buffer | undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        bodyBuf = await readRequestBody(req);
      }

      const headers: Record<string, string> = {
        'X-API-ID': publicKey,
        'X-API-TIME': timestamp,
        'X-API-HASH': hash,
        'Accept-Language': forward.get('store_locale') || 'de-AT',
        Accept: 'application/json',
        'User-Agent': 'Mozarthaus-Regiondo-Proxy/1.0',
      };

      if (bodyBuf && bodyBuf.length > 0) {
        headers['Content-Type'] = (req.headers['content-type'] as string) || 'application/json';
      }

      const controller = new AbortController();
      const timeoutMs = 60_000;
      const t = setTimeout(() => controller.abort(), timeoutMs);
      let r: Response;
      try {
        r = await fetch(regiondoUrl, {
          method,
          headers,
          body: bodyBuf && bodyBuf.length > 0 ? bodyBuf : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(t);
      }

      const text = await r.text();
      res.statusCode = r.status;
      res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
      res.end(text);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error('[regiondo-api]', detail, e);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Regiondo proxy request failed',
          detail,
          hint:
            'Check REGIONDO_API_HOST / VITE_REGIONDO_API_HOST (use https://sandbox-api.regiondo.com for sandbox keys, https://api.regiondo.com for live), network/TLS, and that keys match that environment.',
        })
      );
    }
  };
}

function attachMiddleware(
  server: ViteDevServer | PreviewServer,
  publicKey: string,
  privateKey: string,
  regiondoHost: string
) {
  server.middlewares.use(regiondoProxyMiddleware(publicKey, privateKey, regiondoHost));
}

function missingKeysMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: NextFn) => {
    if (req.url?.startsWith('/api/regiondo/')) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error:
            'Regiondo API keys not configured. Set VITE_REGIONDO_PUBLIC_KEY and VITE_REGIONDO_PRIVATE_KEY in .env (see .env.example).',
        })
      );
      return;
    }
    next();
  };
}

function regiondoKeys(env: Record<string, string>): { publicKey: string; privateKey: string } {
  return {
    publicKey: env.VITE_REGIONDO_PUBLIC_KEY || env.REGIONDO_PUBLIC_KEY || '',
    privateKey: env.VITE_REGIONDO_PRIVATE_KEY || env.REGIONDO_PRIVATE_KEY || '',
  };
}

function regiondoApiHost(env: Record<string, string>): string {
  return normalizeRegiondoHost(env.VITE_REGIONDO_API_HOST || env.REGIONDO_API_HOST);
}

export function regiondoProductsApiPlugin(env: Record<string, string>): Plugin {
  const { publicKey, privateKey } = regiondoKeys(env);
  const regiondoHost = regiondoApiHost(env);

  return {
    name: 'regiondo-products-api',
    configureServer(server) {
      if (!publicKey || !privateKey) {
        server.middlewares.use(missingKeysMiddleware());
        return;
      }
      attachMiddleware(server, publicKey, privateKey, regiondoHost);
    },
    configurePreviewServer(server) {
      if (!publicKey || !privateKey) {
        server.middlewares.use(missingKeysMiddleware());
        return;
      }
      attachMiddleware(server, publicKey, privateKey, regiondoHost);
    },
  };
}
