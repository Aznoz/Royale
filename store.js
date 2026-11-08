// Ukládání účtů do jednoho JSON souboru. Na Renderu nastav DATA_DIR na cestu trvalého disku (Disks → mount path), jinak se po restartu smaže.
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.DATA_DIR || './data';
const FILE = path.join(DIR, 'accounts.json');
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const accounts = new Map();

try {
  if (fs.existsSync(FILE)) { const o = JSON.parse(fs.readFileSync(FILE, 'utf8')); for (const [k, v] of Object.entries(o)) accounts.set(k, v); console.log(`store: načteno ${accounts.size} účtů z ${FILE}`); }
  else console.log(`store: nový soubor ${FILE}`);
} catch (e) { console.error('store: soubor s účty nejde načíst, začínám prázdný', e.message); }

let timer = null;
function writeNow() {
  timer = null;
  try { fs.mkdirSync(DIR, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(accounts))); fs.renameSync(tmp, FILE); } catch (e) { console.error('store: uložení se nepovedlo', e.message); }
}
export function markDirty() { if (!timer) timer = setTimeout(writeNow, 1500); }
export function flush() { if (timer) { clearTimeout(timer); writeNow(); } }
process.on('SIGTERM', () => { flush(); process.exit(0); });
process.on('SIGINT', () => { flush(); process.exit(0); });

export const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
/** Účet se pozná jen podle tokenu (náhodný řetězec uložený v zařízení). Neexistuje-li, vznikne nový. */
export function resolveAccount({ token, name }) {
  let acc = accounts.get(token);
  if (!acc) { acc = { name: cleanName(name) || 'Hráč', avatar: null, created: Date.now() }; accounts.set(token, acc); markDirty(); }
  return { acc, linked: true };
}
export function renameAccount(token, name) { const acc = accounts.get(token); const n = cleanName(name); if (!acc || !n) return false; acc.name = n; markDirty(); return true; }
export const accountCount = () => accounts.size;
