// Minimal zero-dependency static file server, only so `npm start` opens something.
// The game itself is plain HTML + a compiled script and also runs straight from file://.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel === '/' ? 'index.html' : rel);

  try {
    if ((await stat(file)).isDirectory()) {
      // A directory URL has to end in "/", otherwise the browser resolves the
      // page's relative links against its parent: /learn asks for /game.js.
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
        return;
      }
      file = join(file, 'index.html');
    }
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('404 Not Found');
    return;
  }

  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('403 Forbidden');
    return;
  }

  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`Pong running at http://localhost:${PORT}`);
});
