import { createServer } from 'node:http';
import { attachHub } from './hub.js';

const server = createServer((req, res) => {
  hub.http(req, res, () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'Little Leaf multiplayer', status: 'ok' }));
  });
});
const hub = attachHub(server, { origins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
const port = Number(process.env.PORT || 8787);
server.listen(port, '0.0.0.0', () => console.log(`Little Leaf multiplayer listening on ${port}`));
const shutdown = () => { hub.close(); server.close(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
