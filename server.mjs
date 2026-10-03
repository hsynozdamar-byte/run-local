// Run Local: projeleri tarar, ikonlarıyla listeler, tek tıkla çalıştırır/durdurur.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const PORT = Number(process.env.PORT) || 4888;
const HOME = homedir();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(HERE, "state.json");
const RESUME_FILE = path.join(HERE, ".resume.json");
// Panel kodu değişince arayüz "yeniden başlat" der; açılıştaki dosya zamanlarıyla karşılaştırılır.
const codeStamp = () => ["server.mjs", "static.mjs"].map((f) => { try { return fs.statSync(path.join(HERE, f)).mtimeMs; } catch { return 0; } }).join();
const BOOT_STAMP = codeStamp();
const SKIP = new Set(["node_modules", "public", "src", "app", "assets", "dist", "build", "out", "docs", "design",
  "scripts", "vendor", "lib", "components", "localhost-manager", "run-local",
  "Library", "Applications", "Pictures", "Music", "Movies", "Public"]);

// state.json: { roots: [...], extra: [...], hidden: [...], names: {rel: "Ad"}, groups: [{id, name, collapsed, items: [rel]}] }
function loadState() {
  // Varsayılan: yaygın proje klasörlerinden hangileri varsa.
  const roots = ["Developer", "Projects", "projects", "code", "Code", "dev", "src", "Sites", "Documents/GitHub"]
    .map((d) => path.join(HOME, d)).filter((d) => fs.existsSync(d)).map((d) => fs.realpathSync.native(d))
    .filter((d, i, a) => a.indexOf(d) === i); // macOS büyük/küçük harf duyarsız: Projects = projects
  const def = { roots: roots.length ? roots : [path.join(HOME, "Developer")], extra: [], hidden: [], names: {}, groups: [] };
  try { return { ...def, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) }; } catch { return def; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
let state = loadState();
if (!fs.existsSync(STATE_FILE)) saveState(state);

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
async function sh(cmd, args, opts = {}) {
  try { return (await run(cmd, args, { maxBuffer: 8 << 20, timeout: 4000, ...opts })).stdout; } catch (e) { return e.stdout || ""; }
}

// ---------- tarama ----------
function detect(dir) {
  const items = (() => { try { return fs.readdirSync(dir); } catch { return []; } })();
  const xcode = items.find((f) => f.endsWith(".xcodeproj"));
  const pkg = items.includes("package.json") ? readJSON(path.join(dir, "package.json")) : null;
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const scripts = pkg?.scripts || {};
  let kind = null, cmd = null, install = null;
  const pm = items.includes("pnpm-lock.yaml") ? "pnpm"
    : (items.includes("bun.lock") || items.includes("bun.lockb")) && !items.includes("package-lock.json") ? "bun" : "npm";
  const script = scripts.dev ? "dev" : scripts.start ? "start" : null;
  if (pkg && script) {
    kind = deps.next ? "Next" : deps.vite ? "Vite" : (deps.remotion || deps["@remotion/cli"]) ? "Remotion" : deps.astro ? "Astro" : "Node";
    cmd = `${pm} run ${script}`;
    if (!items.includes("node_modules")) install = `${pm} install`;
  } else if (xcode) { kind = "Xcode"; cmd = xcode; }
  else if (items.includes("serve.mjs")) { kind = "Statik"; cmd = "node serve.mjs"; }
  else if (items.includes("index.html")) { kind = "Statik"; cmd = null; }
  else return null;
  return { kind, cmd, install, pkg, items };
}

function findIcon(dir, items) {
  const cands = ["app/icon.svg", "app/icon.png", "src/app/icon.svg", "src/app/icon.png", "app/apple-icon.png", "src/app/apple-icon.png",
    "public/apple-touch-icon.png", "public/icon.svg", "public/icon.png", "public/icon-192.png", "public/favicon.svg",
    "public/favicon.png", "public/favicon-32x32.png", "public/favicon-32.png", "favicon.svg", "assets/favicon.svg"];
  for (const c of cands) if (exists(path.join(dir, c))) return { file: c };
  // index.html <link rel=icon>
  if (items.includes("index.html")) {
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8").slice(0, 20000);
    const links = [...html.matchAll(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*>/gi)].map((m) => m[0]);
    links.sort((a, b) => /apple-touch/.test(b) - /apple-touch/.test(a) || /svg/.test(b) - /svg/.test(a));
    for (const l of links) {
      const href = (l.match(/href=(["'])(.*?)\1/) || [])[2];
      if (!href) continue;
      if (href.startsWith("data:")) return { data: href };
      const clean = href.split("?")[0].replace(/^\.?\//, "");
      for (const c of [clean, "public/" + clean]) {
        const full = path.resolve(dir, c);
        if (full.startsWith(dir + path.sep) && exists(full)) return { file: c }; // proje klasörünün dışına çıkma
      }
    }
  }
  for (const c of ["app/favicon.ico", "src/app/favicon.ico", "public/favicon.ico"]) if (exists(path.join(dir, c))) return { file: c };
  const xc = items.find((f) => f.endsWith(".xcodeproj"));
  if (xc) {
    const base = path.join(dir, xc.replace(".xcodeproj", ""));
    const hit = findAppIcon(base, 0);
    if (hit) return { file: path.relative(dir, hit) };
  }
  return null;
}
function findAppIcon(dir, depth) {
  if (depth > 4) return null;
  let items; try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory() && it.name === "AppIcon.appiconset") {
      const pngs = fs.readdirSync(p).filter((f) => f.endsWith(".png")).map((f) => [f, fs.statSync(path.join(p, f)).size]).sort((a, b) => b[1] - a[1]);
      if (pngs[0]) return path.join(p, pngs[0][0]);
    }
  }
  for (const it of items) if (it.isDirectory() && !it.name.startsWith(".")) { const r = findAppIcon(path.join(dir, it.name), depth + 1); if (r) return r; }
  return null;
}

async function lastTouched(dir) {
  if (exists(path.join(dir, ".git"))) {
    const t = Number((await sh("git", ["-C", dir, "log", "-1", "--format=%ct"])).trim());
    if (t) return t * 1000;
  }
  let max = 0;
  for (const f of ["package.json", "index.html", "src", "app", "public", "."]) {
    try { max = Math.max(max, fs.statSync(path.join(dir, f)).mtimeMs); } catch {}
  }
  return max;
}

function walk(dir, depth, out) {
  const d = detect(dir);
  if (d) {
    out.push({ dir, ...d });
    // fitsync gibi: kök proje + alt klasörlerde ayrı projeler (workspace değilse)
    if (d.pkg && !d.pkg.workspaces && depth < 2) for (const c of children(dir)) if (exists(path.join(c, "package.json"))) walk(c, depth + 1, out);
    return;
  }
  if (depth < 2) for (const c of children(dir)) walk(c, depth + 1, out);
}
function children(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_") && !SKIP.has(e.name))
      .map((e) => path.join(dir, e.name));
  } catch { return []; }
}

const tilde = (d) => d.replace(HOME, "~");
function folders() { return { roots: state.roots.map(tilde), extra: state.extra.map(tilde) }; }
const pretty = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
async function describe(p) {
  const rel = p.dir.replace(HOME + "/", "~/");
  const parent = path.basename(path.dirname(p.dir));
  const icon = findIcon(p.dir, p.items);
  if (icon?.file) try { icon.v = Math.round(fs.statSync(path.join(p.dir, icon.file)).mtimeMs); } catch {}
  return {
    id: Buffer.from(p.dir).toString("base64url"), dir: p.dir, rel,
    name: state.names[rel] || pretty(path.basename(p.dir)),
    group: [...state.roots, ...state.extra.map((e) => path.dirname(e))].includes(path.dirname(p.dir)) ? "" : pretty(parent),
    kind: p.kind, cmd: p.cmd, install: p.install, icon,
    touched: await lastTouched(p.dir),
  };
}
let cache = { at: 0, list: [] };
async function scan(force) {
  if (!force && Date.now() - cache.at < 30000) return cache.list;
  const found = [];
  for (const r of state.roots) for (const c of children(r)) walk(c, 1, found);
  for (const e of state.extra) if (exists(e)) { const d = detect(e); if (d) found.push({ dir: e, ...d }); }
  const list = await Promise.all(found.map(describe));
  list.sort((a, b) => b.touched - a.touched);
  cache = { at: Date.now(), list };
  return list;
}
const byId = async (id) => (await scan()).find((p) => p.id === id);

// ---------- süreçler ----------
const procs = new Map(); // id -> { child, pid, url, log[], status, startedAt }
const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(?::(\d+))?[^\s'"]*/;

function freePort(start) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(freePort(start + 1)));
    s.listen(start, "127.0.0.1", () => s.close(() => resolve(start)));
  });
}
function openURL(url) {
  if (!process.env.RL_NO_OPEN) execFile("open", [url]);
}

async function start(p, quiet) {
  const cur = procs.get(p.id);
  if (cur && cur.status !== "stopped") return cur;
  if (p.kind === "Xcode") { execFile("open", [path.join(p.dir, p.cmd)]); return null; }
  const port = await freePort(p.kind === "Statik" ? 5500 : 3100);
  let cmd = p.cmd;
  if (p.kind === "Statik" && !cmd) cmd = `node ${JSON.stringify(path.join(HERE, "static.mjs"))} .`;
  if (p.install) cmd = `${p.install} && ${cmd}`;
  const child = spawn("/bin/zsh", ["-c", cmd], {
    cwd: p.dir, detached: true,
    env: { ...process.env, PORT: String(port), BROWSER: "none", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const rec = { child, pid: child.pid, url: null, log: [], status: p.install ? "installing" : "starting", startedAt: Date.now(), opened: !!quiet };
  procs.set(p.id, rec);
  const onData = (buf) => {
    for (const raw of buf.toString().split(/\r?\n/)) {
      const line = raw.replace(ANSI, "");
      if (!line.trim()) continue;
      rec.log.push(line); if (rec.log.length > 400) rec.log.shift();
      if (rec.status === "installing" && /dev|vite|next|remotion|serve/i.test(line) && !/added|packages|audit/i.test(line)) rec.status = "starting";
      const m = !rec.url && line.match(URL_RE);
      if (m && m[1]) {
        rec.url = m[0].replace(/0\.0\.0\.0|127\.0\.0\.1|\[::1?\]/, "localhost").replace(/[).,]+$/, "");
        rec.status = "running";
        if (!rec.opened) { rec.opened = true; openURL(rec.url); }
      }
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("exit", (code) => {
    rec.status = "stopped"; rec.code = code;
    rec.log.push(state.lang === "en" ? `— process exited (code ${code ?? "signal"}) —` : `— süreç kapandı (kod ${code ?? "sinyal"}) —`);
  });
  return rec;
}

function killTree(pid, sig) { try { process.kill(-pid, sig); return true; } catch { try { process.kill(pid, sig); return true; } catch { return false; } } }

// Dışarıdan açılmış olanlar dahil: dinleyen portların cwd'si proje klasöründe mi?
async function listening() {
  const out = await sh("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]);
  const ports = new Map(); let pid;
  for (const line of out.split("\n")) {
    if (line[0] === "p") pid = Number(line.slice(1));
    else if (line[0] === "n" && pid) { const m = line.match(/:(\d+)$/); if (m) (ports.get(pid) || ports.set(pid, new Set()).get(pid)).add(Number(m[1])); }
  }
  const pids = [...ports.keys()].filter((p) => p !== process.pid);
  if (!pids.length) return [];
  const cwdOut = await sh("lsof", ["-a", "-p", pids.join(","), "-d", "cwd", "-Fpn"]);
  const res = []; let cur;
  for (const line of cwdOut.split("\n")) {
    if (line[0] === "p") cur = Number(line.slice(1));
    else if (line[0] === "n" && cur) res.push({ pid: cur, cwd: line.slice(1), ports: [...ports.get(cur)].sort((a, b) => a - b) });
  }
  return res;
}

async function status() {
  const list = await scan();
  const live = await listening();
  // Her dinleyen süreci en spesifik projeye bağla (fitsync/fitsync-landing, fitsync'e değil).
  const owner = new Map();
  for (const l of live) {
    const hit = list.filter((p) => l.cwd === p.dir || l.cwd.startsWith(p.dir + "/")).sort((a, b) => b.dir.length - a.dir.length)[0];
    if (hit) owner.set(l, hit.id);
  }
  const out = {};
  for (const p of list) {
    const rec = procs.get(p.id);
    const ext = live.filter((l) => owner.get(l) === p.id);
    const port = ext.flatMap((e) => e.ports).find((x) => x < 49152);
    let st = rec?.status && rec.status !== "stopped" ? rec.status : null;
    let url = rec?.url || null;
    if (port) { st = "running"; url = url || `http://localhost:${port}`; }
    if (st) out[p.id] = { status: st, url, managed: !!rec && rec.status !== "stopped", pids: ext.map((e) => e.pid) };
    else if (rec?.status === "stopped" && rec.code && rec.code !== 0 && Date.now() - rec.startedAt < 600000) out[p.id] = { status: "error" };
  }
  return out;
}

// ---------- http ----------
const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".webp": "image/webp" };
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };

// Yalnızca bu bilgisayardan, panelin kendi adresinden gelen isteklere cevap ver.
// Host kontrolü DNS rebinding'i, Origin kontrolü başka sitelerin istek atmasını engeller.
const ALLOWED = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
function trusted(req) {
  if (!ALLOWED.has(req.headers.host)) return false;
  const origin = req.headers.origin;
  return !origin || ALLOWED.has(origin.replace(/^http:\/\//, ""));
}

const server = http.createServer(async (req, res) => {
  if (!trusted(req)) { res.writeHead(403); return res.end("forbidden"); }
  const url = new URL(req.url, "http://x");
  const id = url.searchParams.get("id");
  const mut = req.method === "POST" && req.headers["x-rl"] === "1";
  try {
    if (url.pathname === "/api/projects") {
      const list = await scan(url.searchParams.has("refresh"));
      return send(res, 200, list.map(({ dir, icon, ...p }) => ({ ...p, hidden: state.hidden.includes(p.rel), icon: icon ? (icon.data || `/icon?id=${p.id}&v=${icon.v || 0}`) : null,
        full: !!icon?.file && /apple|AppIcon|icon-(192|512)|\.jpe?g$|^public\/icon\.png$|app\/icon\.png$/i.test(icon.file) })));
    }
    if (url.pathname === "/api/status") return send(res, 200, await status());
    if (url.pathname === "/icon") {
      const p = await byId(id);
      if (!p?.icon?.file) return send(res, 404, "");
      res.writeHead(200, { "content-type": MIME[path.extname(p.icon.file).toLowerCase()] || "application/octet-stream", "cache-control": "max-age=31536000, immutable" });
      return fs.createReadStream(path.join(p.dir, p.icon.file)).pipe(res);
    }
    if (url.pathname === "/api/log") {
      const rec = procs.get(id);
      return send(res, 200, { log: rec?.log || [], status: rec?.status || null });
    }
    if (url.pathname === "/api/folders") return send(res, 200, folders());
    if (mut && url.pathname === "/api/folders/add") {
      let dir = url.searchParams.get("path") || "";
      if (url.searchParams.has("pick")) {
        try {
          dir = (await run("osascript", ["-e", "activate", "-e", `POSIX path of (choose folder with prompt "${state.lang === "en" ? "Run Local: choose the folder with your projects" : "Run Local: projelerinin olduğu klasörü seç"}")`], { timeout: 300000 })).stdout.trim();
        } catch { return send(res, 200, { cancelled: true }); }
      }
      dir = path.resolve(dir.trim().replace(/^~(?=\/|$)/, HOME)).replace(/\/+$/, "");
      try { if (!fs.statSync(dir).isDirectory()) throw 0; } catch { return send(res, 400, { error: "Klasör bulunamadı" }); }
      // Klasörün kendisi bir projeyse tek proje olarak, değilse taranacak klasör olarak eklenir.
      const as = detect(dir) ? "project" : "root";
      const key = as === "project" ? "extra" : "roots";
      if (!state[key].includes(dir)) state[key].push(dir);
      saveState(state);
      const list = await scan(true);
      const count = list.filter((p) => p.dir === dir || p.dir.startsWith(dir + "/")).length;
      return send(res, 200, { as, dir, count, ...folders() });
    }
    if (mut && url.pathname === "/api/folders/remove") {
      const dir = url.searchParams.get("path").replace(/^~(?=\/|$)/, HOME);
      state.roots = state.roots.filter((d) => d !== dir);
      state.extra = state.extra.filter((d) => d !== dir);
      saveState(state); await scan(true);
      return send(res, 200, folders());
    }
    if (url.pathname === "/api/settings" && !mut) return send(res, 200, { lang: state.lang || null, order: state.order || [] });
    if (mut && url.pathname === "/api/order") {
      let body = ""; for await (const c of req) { body += c; if (body.length > 1e6) throw new Error("too big"); }
      const o = JSON.parse(body || "[]");
      // Izgaradaki kutucukların sırası: proje yolu ya da "f:<grup id>".
      state.order = (Array.isArray(o) ? o : []).map(String).filter((k, i, a) => a.indexOf(k) === i).slice(0, 5000);
      saveState(state); return send(res, 200, { ok: true });
    }
    if (mut && url.pathname === "/api/settings") {
      let body = ""; for await (const c of req) { body += c; if (body.length > 1e4) throw new Error("too big"); }
      const b = JSON.parse(body || "{}");
      if (["tr", "en"].includes(b.lang)) state.lang = b.lang;
      saveState(state); return send(res, 200, { lang: state.lang || null });
    }
    if (url.pathname === "/api/meta") return send(res, 200, { stale: codeStamp() !== BOOT_STAMP });
    if (mut && url.pathname === "/api/restart") {
      // Bu panelin açtığı sunucuları not et; yeni panel açılınca tarayıcı açmadan geri başlatır.
      const ids = [...procs].filter(([, r]) => r.status !== "stopped").map(([k]) => k);
      fs.writeFileSync(RESUME_FILE, JSON.stringify(ids));
      send(res, 200, { ok: true });
      spawn("/bin/sh", ["-c", `sleep 1; exec node ${JSON.stringify(path.join(HERE, "server.mjs"))} >>/tmp/run-local.log 2>&1`], { detached: true, stdio: "ignore", env: process.env }).unref();
      setTimeout(() => process.kill(process.pid, "SIGTERM"), 100);
      return;
    }
    if (url.pathname === "/api/groups" && !mut) return send(res, 200, state.groups);
    if (mut && url.pathname === "/api/groups") {
      let body = "";
      for await (const c of req) { body += c; if (body.length > 1e6) throw new Error("çok büyük"); }
      const seen = new Set();
      state.groups = (JSON.parse(body) || []).filter((g) => g && typeof g === "object").slice(0, 100).map((g) => ({
        id: String(g.id || Math.random().toString(36).slice(2, 10)).slice(0, 24),
        name: String(g.name || "").trim().slice(0, 40) || "Grup",
        collapsed: !!g.collapsed,
        // Klasörün ızgaradaki sırası; yoksa en başta durur.
        ...(Number.isFinite(g.at) ? { at: Math.max(0, Math.min(9999, Math.floor(g.at))) } : {}),
        // Bir proje yalnız bir grupta durur.
        items: (Array.isArray(g.items) ? g.items : []).map(String).filter((r) => !seen.has(r) && seen.add(r)),
      }));
      saveState(state); return send(res, 200, state.groups);
    }
    if (!mut) return send(res, 200, fs.readFileSync(path.join(HERE, "index.html"), "utf8"), "text/html; charset=utf-8");

    const p = await byId(id);
    if (!p) return send(res, 404, { error: "proje yok" });
    if (url.pathname === "/api/run") {
      const st = (await status())[p.id];
      if (st?.status === "running" && st.url) { openURL(st.url); return send(res, 200, { opened: st.url }); }
      await start(p);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/stop") {
      const rec = procs.get(p.id);
      if (rec && rec.status !== "stopped") {
        killTree(rec.pid, "SIGTERM");
        setTimeout(() => rec.status !== "stopped" && killTree(rec.pid, "SIGKILL"), 3000);
      }
      for (const pid of (await status())[p.id]?.pids || []) killTree(pid, "SIGTERM");
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/reveal") { execFile("open", [p.dir]); return send(res, 200, { ok: true }); }
    if (url.pathname === "/api/code") {
      const app = ["Cursor", "Visual Studio Code", "Zed", "Sublime Text"].find((a) => exists(`/Applications/${a}.app`));
      execFile("open", app ? ["-a", app, p.dir] : [p.dir]); return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/hide") {
      state.hidden = state.hidden.filter((r) => r !== p.rel);
      if (url.searchParams.get("on") === "1") state.hidden.push(p.rel);
      saveState(state); return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/rescan") {
      const d = detect(p.dir);
      const i = cache.list.findIndex((x) => x.id === p.id);
      if (!d) { cache.list.splice(i, 1); return send(res, 200, { removed: true }); }
      cache.list[i] = await describe({ dir: p.dir, ...d });
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/rename") {
      const name = (url.searchParams.get("name") || "").trim().slice(0, 40);
      if (name) state.names[p.rel] = name; else delete state.names[p.rel];
      saveState(state); cache.at = 0; return send(res, 200, { ok: true });
    }
    send(res, 404, { error: "yok" });
  } catch (e) { send(res, 500, { error: e.message }); }
});
server.listen(PORT, "127.0.0.1", async () => {
  console.log(`Run Local → http://localhost:${PORT}`);
  const ids = readJSON(RESUME_FILE); if (!ids) return;
  fs.rmSync(RESUME_FILE, { force: true });
  for (const id of ids) { const p = await byId(id); if (p) await start(p, true); }
});

// Panel kapanınca başlattığı sunucular da kapansın.
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { for (const r of procs.values()) if (r.status !== "stopped") killTree(r.pid, "SIGTERM"); process.exit(0); });

