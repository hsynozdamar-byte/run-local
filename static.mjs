// Statik klasör sunucusu (önbelleksiz). Kullanım: PORT=5500 node static.mjs <klasör>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || ".");
const PORT = Number(process.env.PORT) || 5500;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain",
};

const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

http.createServer((req, res) => {
  // Başka bir alan adı üzerinden (DNS rebinding) gelen istekleri reddet.
  if (!HOSTS.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end(); }
  let file = path.join(ROOT, p);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  // .env, .git gibi gizli dosyaları sunma
  if (path.relative(ROOT, file).split(path.sep).some((s) => s.startsWith("."))) { res.writeHead(404); return res.end("404"); }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  } catch {
    if (!path.extname(file) && fs.existsSync(file + ".html")) file += ".html";
  }
  fs.stat(file, (err, st) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("404"); }
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range && /video|audio/.test(type)) {
      const start = Number(range[1] || 0), end = range[2] ? Number(range[2]) : st.size - 1;
      res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "content-type": type, "content-length": st.size, "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, "127.0.0.1", () => console.log(`Statik sunucu → http://localhost:${PORT}`));
