/**
 * Simple HTTP server to serve the test dApp
 * Usage: node examples/serve.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Generate random port between 10000-19999 if not specified
const PORT = process.env.PORT || (10000 + Math.floor(Math.random() * 10000));

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath;

  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(__dirname, 'test-dapp.html');
  } else if (req.url.startsWith('/dist/')) {
    filePath = path.join(rootDir, req.url);
  } else {
    filePath = path.join(__dirname, req.url);
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Test dApp server running at:`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Make sure you have:`);
  console.log(`  1. Anvil running: anvil`);
  console.log(`  2. Built dev provider: npm run build:provider:dev`);
  console.log(`  3. Wallet server running: npm start\n`);
});
