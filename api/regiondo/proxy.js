const crypto = require('node:crypto');

const DEFAULT_REGIONDO_HOST = 'https://api.regiondo.com';
const MAX_BODY_BYTES = 2_000_000;

function normalizeHost(raw) {
  const t = String(raw || '').trim().replace(/\/+$/, '');
  if (!t) return DEFAULT_REGIONDO_HOST;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
}

function cleanEnv(raw) {
  return String(raw || '').trim();
}

function sign(publicKey, privateKey, queryString) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const source = timestamp + publicKey + queryString;
  const hash = crypto.createHmac('sha256', privateKey).update(source).digest('hex');
  return { timestamp, hash };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
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

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  console.log(`[Regiondo Proxy] Handling ${req.method} ${req.url}`);
  // Try both prefixed and non-prefixed env vars
  const publicKey = cleanEnv(process.env.VITE_REGIONDO_PUBLIC_KEY || process.env.REGIONDO_PUBLIC_KEY || '');
  const privateKey = cleanEnv(process.env.VITE_REGIONDO_PRIVATE_KEY || process.env.REGIONDO_PRIVATE_KEY || '');
  const regiondoHost = normalizeHost(cleanEnv(process.env.VITE_REGIONDO_API_HOST || process.env.REGIONDO_API_HOST));

  if (!publicKey || !privateKey) {
    return json(res, 503, {
      error: 'Regiondo credentials missing',
      hint: 'Set REGIONDO_PUBLIC_KEY and REGIONDO_PRIVATE_KEY in environment variables.',
    });
  }

  const method = req.method || 'GET';
  if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const prefix = '/api/regiondo/';
    let subPath = '';

    if (url.pathname.startsWith(prefix)) {
      subPath = url.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
    }

    if (!subPath) {
      const pathParam = req.query?.path;
      const parts = Array.isArray(pathParam) ? pathParam : [pathParam].filter(Boolean);
      subPath = parts.join('/').replace(/^\/+|\/+$/g, '');
    }

    if (!subPath) {
      return json(res, 400, { error: 'Missing Regiondo subpath' });
    }

    const forwardParams = new URLSearchParams(url.search);
    const queryString = forwardParams.toString();
    const regiondoPath = `/v1/${subPath.replace(/^\/+/, '')}`;
    const regiondoUrl = queryString
      ? `${regiondoHost}${regiondoPath}?${queryString}`
      : `${regiondoHost}${regiondoPath}`;

    const { timestamp, hash } = sign(publicKey, privateKey, queryString);
    const headers = {
      'X-API-ID': publicKey,
      'X-API-TIME': timestamp,
      'X-API-HASH': hash,
      'Accept-Language': forwardParams.get('store_locale') || 'de-AT',
      Accept: 'application/json',
      'User-Agent': 'Mozarthaus-Regiondo-Vercel-Proxy/1.0',
    };

    let body;
    if (!['GET', 'DELETE'].includes(method)) {
      const buf = await readBody(req);
      if (buf.length > 0) {
        body = buf;
        headers['Content-Type'] = req.headers['content-type'] || 'application/json';
      }
    }

    const upstream = await fetch(regiondoUrl, {
      method,
      headers,
      body,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('x-regiondo-proxy-host', regiondoHost);
    res.send(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json(res, 502, {
      error: 'Regiondo proxy request failed',
      detail,
    });
  }
};
