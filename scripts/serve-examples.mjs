import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const host = process.env.HAIYUE_EXAMPLES_HOST ?? '127.0.0.1';
const port = Number(process.env.HAIYUE_EXAMPLES_PORT ?? 4173);
const root = resolve('.');
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer((request, response) => {
  const authority = request.headers.host ?? `${host}:${port}`;
  const requestUrl = new URL(request.url ?? '/', `http://${authority}`);
  if (requestUrl.pathname === '/') {
    response.writeHead(302, { Location: '/examples/' });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  let filePath = resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if (statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
    const file = statSync(filePath);
    if (!file.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
      'Content-Length': file.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Haiyue UI examples: http://${host}:${port}/`);
});
