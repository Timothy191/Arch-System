import { createCipheriv, randomBytes } from 'node:crypto';
import EventEmitter from 'node:events';
import http from 'node:http';
import GuacamoleLite from 'guacamole-lite';
import Redis from 'ioredis';
import { consumeJtiOnce, decryptAndValidateLaunchToken } from './token.mjs';

const PORT = Number(process.env.PORT || 8085);
const GUACD_HOST = process.env.GUACD_HOST || 'guacd';
const GUACD_PORT = Number(process.env.GUACD_PORT || 4822);
const TOKEN_SECRET = process.env.REMOTE_DESKTOP_TOKEN_SECRET || '';
const REDIS_URL = process.env.REDIS_URL || '';

const redisClient = REDIS_URL ? new Redis(REDIS_URL, { lazyConnect: true }) : null;
const memoryUsedJti = new Map();

// Ephemeral per-process key shared exclusively with the in-process GuacamoleLite instance
const INTERNAL_CBC_KEY = randomBytes(32).toString('hex').slice(0, 32);

function encryptInternalGuacToken(connection) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(INTERNAL_CBC_KEY, 'utf8'), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ connection }), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString('base64'),
      value: ciphertext.toString('base64'),
    })
  ).toString('base64');
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', guacdHost: GUACD_HOST, guacdPort: GUACD_PORT }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const authenticatedUpgradeEmitter = new EventEmitter();

const guacServer = new GuacamoleLite(
  { server: authenticatedUpgradeEmitter },
  { host: GUACD_HOST, port: GUACD_PORT },
  {
    crypt: {
      cypher: 'AES-256-CBC',
      key: INTERNAL_CBC_KEY,
    },
    log: {
      level: 'ERRORS',
    },
  }
);

server.on('upgrade', async (req, socket, head) => {
  try {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const rawToken = requestUrl.searchParams.get('token');
    const payload = decryptAndValidateLaunchToken({
      token: rawToken,
      secret: TOKEN_SECRET,
    });
    await consumeJtiOnce({
      jti: payload.jti,
      expSeconds: payload.exp,
      redisClient,
      memoryCache: memoryUsedJti,
    });

    const internalToken = encryptInternalGuacToken(payload.connection);
    requestUrl.searchParams.set('token', internalToken);
    req.url = `${requestUrl.pathname}${requestUrl.search}`;
    authenticatedUpgradeEmitter.emit('upgrade', req, socket, head);
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: 'tier2_bridge_upgrade_rejected',
        reason: err instanceof Error ? err.message : 'unauthorized',
        ts: new Date().toISOString(),
      })
    );
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
});

guacServer.on('open', (clientConnection) => {
  console.info(
    JSON.stringify({
      event: 'tier2_bridge_open',
      connectionId: clientConnection?.connectionId ?? 'unknown',
      ts: new Date().toISOString(),
    })
  );
});

guacServer.on('close', (clientConnection) => {
  console.info(
    JSON.stringify({
      event: 'tier2_bridge_close',
      connectionId: clientConnection?.connectionId ?? 'unknown',
      ts: new Date().toISOString(),
    })
  );
});

server.listen(PORT, '0.0.0.0', () => {
  console.info(
    `Arch Tier 2 Remote Support Bridge listening on :${PORT} -> ${GUACD_HOST}:${GUACD_PORT}`
  );
});
