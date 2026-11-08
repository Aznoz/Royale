// Minimální WebSocket server (RFC 6455) bez závislostí. Rozhraní je shodné s tím, co čeká arena.js (on/send/ping/terminate/readyState).
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 1 << 20;

class Socket extends EventEmitter {
  constructor(sock) { super(); this.sock = sock; this.readyState = 1; this.buf = Buffer.alloc(0); this.frag = null; this.fragOp = 0;
    sock.on('data', (d) => this.onData(d)); sock.on('close', () => this.onClose()); sock.on('error', () => this.onClose()); sock.setNoDelay(true); }
  onClose() { if (this.readyState === 3) return; this.readyState = 3; this.emit('close'); }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0; let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; const hi = b.readUInt32BE(2), lo = b.readUInt32BE(6); if (hi > 0) return this.terminate(); len = lo; off = 10; }
      if (len > MAX_PAYLOAD || !masked) return this.terminate();
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4); const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 0x8) { this.rawSend(0x8, payload.subarray(0, 2)); return this.terminate(); }
      if (op === 0x9) { this.rawSend(0xA, payload); continue; }
      if (op === 0xA) { this.emit('pong'); continue; }
      if (op === 0x1 || op === 0x2) { if (fin) { this.emit('message', payload); } else { this.frag = [payload]; this.fragOp = op; } continue; }
      if (op === 0x0 && this.frag) { this.frag.push(payload); if (fin) { const all = Buffer.concat(this.frag); this.frag = null; this.emit('message', all); } else if (this.frag.reduce((a, x) => a + x.length, 0) > MAX_PAYLOAD) return this.terminate(); }
    }
  }
  rawSend(op, payload) {
    if (this.readyState !== 1 && op !== 0x8) return;
    const n = payload.length; let h;
    if (n < 126) { h = Buffer.alloc(2); h[1] = n; } else if (n < 65536) { h = Buffer.alloc(4); h[1] = 126; h.writeUInt16BE(n, 2); } else { h = Buffer.alloc(10); h[1] = 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(n, 6); }
    h[0] = 0x80 | op; try { this.sock.write(Buffer.concat([h, payload])); } catch { /* spojení padlo */ }
  }
  send(data) { this.rawSend(0x1, Buffer.from(String(data))); }
  ping() { this.rawSend(0x9, Buffer.alloc(0)); }
  close() { if (this.readyState === 1) { this.rawSend(0x8, Buffer.from([0x03, 0xe8])); this.readyState = 2; setTimeout(() => this.terminate(), 500).unref(); } }
  terminate() { this.readyState = 3; try { this.sock.destroy(); } catch { /* nic */ } this.emit('close'); this.removeAllListeners(); }
}

/** Připojí WebSocket na `server` (http.Server) pro danou cestu; každé nové spojení předá callbacku. */
export function attachWebSocket(server, pathName, onConnection) {
  server.on('upgrade', (req, sock) => {
    const url = (req.url || '').split('?')[0];
    const key = req.headers['sec-websocket-key'];
    if (url !== pathName || !key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return sock.destroy(); }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    onConnection(new Socket(sock));
  });
}
