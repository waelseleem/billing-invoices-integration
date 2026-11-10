// server.js
const { createServer } = require('http');
const next = require('next');

const host = '192.168.11.117'; // your LAN IP
const port = 3000;

const dev = false; // production mode
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, host, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${host}:${port}`);
  });
});
