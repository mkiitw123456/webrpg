import { WebSocketServer, WebSocket } from 'ws';
import World from './World.js';
import { adminHTTP } from './admin.js';

export function attachHub(server, { world = new World(), origins = [], accounts = null } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const clients = new Map();
  const httpClients = new Map();
  const originAllowed = request => {
    const origin = request.headers.origin;
    if (!origin || origins.includes(origin)) return true;
    try { return new URL(origin).host === request.headers.host; } catch { return false; }
  };
  const send = (ws, data) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) return ws.terminate();
    ws.send(JSON.stringify(data));
  };
  const upgrade = (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/multiplayer') return;
    if (!originAllowed(request)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  };
  server.on('upgrade', upgrade);
  const http = (request, response, next = () => { response.writeHead(404); response.end(); }) => {
    if (adminHTTP(world, request, response)) return;
    const path = request.url?.split('?')[0];
    if (!['/multiplayer/connect', '/multiplayer/sync', '/multiplayer/leave', '/multiplayer/auth/login', '/multiplayer/auth/register'].includes(path)) return next();
    if (!originAllowed(request)) { response.writeHead(403); response.end(); return; }
    const origin = request.headers.origin;
    if (origin && origins.includes(origin)) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.method !== 'POST') { response.writeHead(405); response.end(); return; }
    let body = '', tooLarge = false;
    request.on('data', chunk => { body += chunk; if (body.length > 16384) { tooLarge = true; response.writeHead(413); response.end(); request.destroy(); } });
    request.on('error', () => {});
    request.on('end', async () => {
      if (tooLarge) return;
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      try {
        const m = JSON.parse(body), now = Date.now();
        if(path.startsWith('/multiplayer/auth/')) {if(!accounts)throw Error('帳號服務未啟動'); const result=await accounts.auth(path,m,request.socket.remoteAddress);response.end(JSON.stringify(result));return;}
        if (path === '/multiplayer/connect') {
          let p;
          try { p = accounts ? accounts.connect(m.token,now) : world.connect(typeof m.token === 'string' ? m.token : null, now); }
          catch(error) { response.writeHead(401); response.end(JSON.stringify({error:error.message})); return; }
          httpClients.set(p.token, { p, last: now, queue: [] });
          response.end(JSON.stringify([{ type: 'welcome', id: p.id, token: p.token }, world.snapshot(p, now)])); return;
        }
        const session = httpClients.get(m.token);
        if (!session) { response.writeHead(401); response.end(JSON.stringify({ error: '連線已失效，正在重新連線。' })); return; }
        if (path === '/multiplayer/leave') {
          httpClients.delete(m.token); world.disconnect(session.p); response.end('[]'); return;
        }
        if (!session.windowStart || now - session.windowStart >= 1000) { session.windowStart = now; session.count = 0; }
        if (++session.count > 30) { response.writeHead(429); response.end(JSON.stringify({ error: '同步過於頻繁，請稍候。' })); return; }
        session.last = now;
        if (!Array.isArray(m.commands) || m.commands.length > 25) throw new Error('指令格式錯誤。');
        for (const command of m.commands) {
          try { if (command && typeof command.type === 'string') world.command(session.p, command, now); }
          catch (error) { session.queue.push({ type: 'notice', text: error.message }); }
        }
        response.end(JSON.stringify([world.snapshot(session.p, now), ...session.queue.splice(0)]));
      } catch (error) { response.writeHead(400); response.end(JSON.stringify({ error: error.message })); }
    });
  };
  wss.on('connection', ws => {
    let player;
    let count = 0, windowStart = Date.now();
    const timeout = setTimeout(() => { if (!player) ws.close(1008, 'hello required'); }, 5000);
    ws.on('error', () => {});
    ws.on('message', bytes => {
      try {
        const now = Date.now();
        if (now - windowStart > 1000) { count = 0; windowStart = now; }
        if (++count > 100) return ws.close(1008, 'rate limit');
        const m = JSON.parse(bytes.toString());
        if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('訊息格式錯誤。');
        if (!player) {
          if (m.type !== 'hello') throw new Error('請先建立連線。');
          player = accounts ? accounts.connect(m.token,now) : world.connect(typeof m.token === 'string' ? m.token : null, now);
          clients.set(ws, player);
          clearTimeout(timeout);
          send(ws, { type: 'welcome', id: player.id, token: player.token });
          send(ws, world.snapshot(player, now));
        } else world.command(player, m, now);
      } catch (error) { send(ws, { type: player ? 'notice' : 'auth-error', text: error.message }); }
    });
    ws.on('close', () => {
      clearTimeout(timeout);
      if (player) world.disconnect(player);
      clients.delete(ws);
    });
  });
  let last = Date.now(), ticks = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    world.tick(now, Math.min(0.1, (now - last) / 1000)); last = now;
    const events = world.events.splice(0);
    for (const [token, session] of httpClients) {
      if (now - session.last > 15000) { httpClients.delete(token); world.disconnect(session.p); continue; }
      for (const event of events) if (event.to === session.p.id || (event.room && event.room === session.p.room)) session.queue.push(event);
      if (session.queue.length > 100) session.queue.splice(0, session.queue.length - 100);
    }
    ticks++;
    for (const [ws, p] of clients) {
      if (ticks % 2 === 0) send(ws, world.snapshot(p, now));
      for (const event of events) if (event.to === p.id || (event.room && event.room === p.room)) send(ws, event);
    }
  }, 50);
  timer.unref();
  return { world, http, close() { clearInterval(timer); server.off('upgrade', upgrade); for (const ws of wss.clients) ws.terminate(); for (const s of httpClients.values()) world.disconnect(s.p); httpClients.clear(); wss.close(); } };
}
