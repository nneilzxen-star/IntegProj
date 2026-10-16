const { createServer } = require('node:http');
const { createReadStream, statSync } = require('node:fs');
const { extname, resolve, sep } = require('node:path');
const { execFile } = require('node:child_process');

const ROOT = __dirname;
const HOST = '127.0.0.1';
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(ROOT, relativePath);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    if (!statSync(filePath).isFile()) throw new Error('Not a file');
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('File not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) response.writeHead(500);
      response.end('Could not read file');
    })
    .pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Another app is already using port ${server.address()?.port ?? 4173}. Close it and run start.bat again.`);
  } else {
    console.error('Could not start the storefront server:', error.message);
  }
  process.exitCode = 1;
});

server.listen(0, HOST, () => {
  const address = server.address();
  const url = `http://${HOST}:${address.port}/`;
  console.log(`Damitan ni Ron is ready at ${url}`);
  console.log('Keep this window open while you use the store. Press Ctrl+C to stop.');
  execFile('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], { windowsHide: true }, (error) => {
    if (error) console.log(`Open this address in your browser: ${url}`);
  });
});
