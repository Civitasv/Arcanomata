import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const root = resolve(process.cwd(), process.argv.includes('--dist') ? 'dist' : '.');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};
const port = Number(process.env.PORT || 4173);
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const name = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const file = resolve(root, '.' + name);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!(await stat(file)).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = extname(file);
    if (!Object.hasOwn(contentTypes, ext)) {
      res.writeHead(415); res.end('Unsupported file type'); return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => {
  process.stdout.write('Arcanomata available at http://localhost:' + port + '\n');
});
