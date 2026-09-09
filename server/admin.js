import { timingSafeEqual } from 'node:crypto';

export function adminHTTP(world, request, response) {
  const path = request.url?.split('?')[0];
  if (!['/admin/players', '/admin/gold'].includes(path)) return false;
  const reply = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  // A standalone local HTML file has Origin: null. Bearer authentication is
  // mandatory for every request; no cookies or player session grant access.
  response.setHeader('Access-Control-Allow-Origin', 'null');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') { reply(204, null); return true; }
  const key = process.env.ADMIN_TOKEN;
  const actual = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${key || ''}`);
  if (!key || key.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) { reply(401, { error: '管理金鑰未設定或不正確。' }); return true; }
  if (path === '/admin/players' && request.method === 'GET') {
    reply(200, [...world.players.values()].map(p => ({ id: p.id, name: p.name, online: p.online, gold: p.rpg.gold })));
  } else if (path === '/admin/gold' && request.method === 'POST') {
    let body = '', size = 0;
    request.on('data', chunk => { size += chunk.length; if (size <= 4096) body += chunk; });
    request.on('end', () => {
      if (size > 4096) return reply(413, { error: '請求過大。' });
      try {
        const { id, gold, previousGold } = JSON.parse(body);
        const p = world.players.get(id);
        if (!p) return reply(404, { error: '角色不存在，請重新整理列表。' });
        if (!Number.isSafeInteger(gold) || gold < 0 || gold > 1000000000) return reply(400, { error: '金幣必須是 0～1,000,000,000 的整數。' });
        if (p.rpg.gold !== previousGold) return reply(409, { error: '玩家餘額已改變，請重新整理後再修改。' });
        p.rpg.gold = gold;
        reply(200, { id, gold });
      } catch { reply(400, { error: '請求格式錯誤。' }); }
    });
  } else reply(405, { error: '不支援此操作。' });
  return true;
}
