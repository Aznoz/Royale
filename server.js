// ARÉNA VĚŽÍ – samostatný server pro Unity klienta: HTTP API (/api/arena/<akce>) + WebSocket (/arena). Bez závislostí, stačí Node 18+.
import http from 'node:http';
import * as Arena from './arena.js';
import * as Store from './store.js';

Arena.init({ markDirty: Store.markDirty, TOKEN_RE: Store.TOKEN_RE, resolveAccount: Store.resolveAccount });
import { attachWebSocket } from './ws.js';

const PORT = Number(process.env.PORT) || 3000;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method === 'GET' && (url === '/' || url === '/health')) return json(res, 200, { ok: true, game: 'arena-vezi', accounts: Store.accountCount(), ...Arena.stats() });
  const m = url.match(/^\/api\/arena\/([a-z]+)$/);
  if (req.method === 'POST' && m) {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 300_000) { req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return json(res, 400, { error: 'Špatný JSON.' }); }
      try {
        if (m[1] === 'name') { const ok = typeof body.token === 'string' && Store.TOKEN_RE.test(body.token) && Store.renameAccount(body.token, body.name); if (!ok) Store.resolveAccount({ token: body.token, name: body.name }); }
        const r = Arena.api(m[1] === 'name' ? 'me' : m[1], body);
        return json(res, r.status, r.json);
      } catch (e) { console.error('api chyba', e); return json(res, 500, { error: 'Chyba serveru.' }); }
    });
    return;
  }
  json(res, 404, { error: 'Nenalezeno.' });
});
attachWebSocket(server, '/arena', (ws) => Arena.handleConnection(ws));
server.listen(PORT, () => console.log(`Aréna věží server běží na portu ${PORT}`));
