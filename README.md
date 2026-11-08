# Aréna věží – server

Samostatný Node.js server (žádné závislosti, stačí Node 18+). Hra je autoritativní: server drží simulaci, boty, účty, balíčky, truhly a vylepšení.

## Spuštění lokálně
```
cd ArenaServer
npm start            # poslouchá na http://localhost:3000
```
V Unity pak v Nastavení nech adresu `http://localhost:3000` (na PC v editoru).

## Nasazení na Render
1. Nahraj obsah složky `ArenaServer` do nového GitHub repozitáře (soubor `package.json` musí být v kořeni repozitáře).
2. Na https://render.com: **New + → Web Service** → vyber repozitář.
   * Runtime: **Node**
   * Build command: `npm install`
   * Start command: `npm start`
   * Health check path: `/health`
3. **Environment** → přidej proměnnou `ARENA_SECRET` (libovolný dlouhý náhodný řetězec). **Po nastavení ho už neměň** – podepisují se jím zálohy postupu.
4. Trvalé ukládání účtů (volitelné, ale doporučené):
   * plán **Starter** (placený) → **Disks → Add Disk**, mount path např. `/var/data`, 1 GB,
   * přidej proměnnou `DATA_DIR=/var/data`.
   * Na free plánu disk není: účty se po restartu/redeploy smažou, ale hra si je sama obnoví z podepsané zálohy, kterou má každé zařízení uloženou u sebe (funguje jen když zůstane stejné `ARENA_SECRET`).
5. Po nasazení zkopíruj adresu služby (např. `https://arena-vezi-server.onrender.com`) a v Unity hře ji zadej v **Nastavení → Adresa serveru**.

Free plán Renderu usíná po ~15 min nečinnosti; první připojení pak trvá asi minutu (hra to ukáže jako „Připojuji k serveru…“).

## Co server nabízí
* `GET /health` – stav serveru
* `POST /api/arena/{me|deck|upgrade|open|restore|name}` – profil, balíček, vylepšení karet, otevření truhly, obnova zálohy, jméno
* WebSocket `/arena` – zápasy (boti, rychlá hra, místnosti s kódem)
