'use strict';

// The local-release launcher (SPEC-042 §§1-2). Built into a Node Single
// Executable Application per platform by .github/workflows/release-local.yml
// — this file is the SEA's `main`, so it has to stay CommonJS and dependency-
// free (no `require` beyond node: builtins survives packaging). It serves the
// `app/` directory next to the launcher binary on localhost and opens a
// browser, because ES modules and the File System Access API both refuse
// `file://` (SPEC-042 §1).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const ROOT = path.join(path.dirname(process.execPath), 'app');
const PORT = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendIndexFallback(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  });
}

// Hash-routed SPA (`routes.ts`): any path the file system doesn't have falls
// back to index.html rather than 404ing.
function sendIndexFallback(res) {
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  sendFile(res, filePath);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`OSR VTT is running at ${url}`);
  console.log('Keep this window open while you play. Close it to stop the app.');

  const openCommand =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  execFile(openCommand[0], openCommand[1], () => {
    // Best-effort — if nothing opens automatically, the URL above still works.
  });
});
