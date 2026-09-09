import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import World from '../server/World.js';
import { attachHub } from '../server/hub.js';
import { DEFAULT_BINDINGS, rebind } from '../src/systems/Controls.js';

function team(world, leader, member) {
  world.command(leader, { type: 'party-create' });
  if (!member) return;
  world.command(leader, { type: 'party-invite', target: member.id });
  const invite = [...world.invites.values()].find(i => i.to === member.id);
  world.command(member, { type: 'party-answer', id: invite.id, accept: true });
}

test('key bindings reject conflicts and reserved/unknown keys without mutating existing settings', () => {
  assert.ok(rebind(DEFAULT_BINDINGS, 'attack', 'KeyK').error);
  assert.ok(rebind(DEFAULT_BINDINGS, 'attack', 'Escape').error);
  assert.ok(rebind(DEFAULT_BINDINGS, '__proto__', 'KeyZ').error);
  const changed = rebind(DEFAULT_BINDINGS, 'attack', 'KeyZ');
  assert.equal(changed.bindings.attack, 'KeyZ');
  assert.equal(DEFAULT_BINDINGS.attack, 'KeyJ');
});

test('village is safe, party members travel together, different parties have isolated monsters and drops', () => {
  const world = new World(), a = world.connect(), b = world.connect(), c = world.connect();
  assert.equal(a.room, 'village');
  world.command(a, { type: 'cast', skill: 'wave' });
  assert.equal(a.rpg.mp, 60);
  team(world, a, b); team(world, c);
  assert.throws(() => world.command(b, { type: 'dungeon-enter' }), /隊長/);
  world.command(a, { type: 'dungeon-enter' });
  world.command(c, { type: 'dungeon-enter' });
  assert.equal(a.room, b.room); assert.notEqual(a.room, c.room);
  assert.equal(world.snapshot(a, Date.now()).peers[0].id, b.id);
  assert.equal(world.snapshot(c, Date.now()).peers.length, 0);
  const now = Date.now();
  world.command(a, { type: 'cast', skill: 'wave' }, now);
  world.command(a, { type: 'cast', skill: 'wave' }, now + 1800);
  assert.equal(world.instances.get(a.room).enemies[0].hp, 0);
  assert.equal(world.instances.get(c.room).enemies[0].hp, 36);
  assert.equal(a.rpg.exp, 25); assert.equal(b.rpg.exp, 25); assert.equal(c.rpg.exp, 0);
  assert.equal(world.instances.get(a.room).drops.length, 1);
  assert.equal(world.instances.get(c.room).drops.length, 0);
  // 同一戰利品同時進入兩個玩家拾取範圍，只能給一份。
  a.x = b.x = world.instances.get(a.room).drops[0].x;
  world.tick(now + 1850, 0.05);
  assert.equal(a.rpg.gold + b.rpg.gold, 12);
  assert.equal(Number(a.rpg.inventory.includes('iron')) + Number(b.rpg.inventory.includes('iron')), 1);
  const oldRoom = a.room;
  world.command(a, { type: 'dungeon-return' });
  assert.equal(a.room, 'village'); assert.equal(b.room, 'village');
  assert.equal(world.instances.has(oldRoom), false);
});

test('party invitations require consent, expire, enforce capacity, and cannot join a departed party', () => {
  const w = new World(), a = w.connect(), players = Array.from({ length: 4 }, () => w.connect());
  team(w, a);
  for (const p of players.slice(0, 3)) {
    w.command(a, { type: 'party-invite', target: p.id });
    assert.equal(p.partyId, null);
    w.command(p, { type: 'party-answer', id: [...w.invites.values()].find(i => i.to === p.id).id, accept: true });
  }
  assert.throws(() => w.command(a, { type: 'party-invite', target: players[3].id }), /4 人/);
  w.command(players[2], { type: 'party-leave' });
  w.command(a, { type: 'party-invite', target: players[3].id });
  const invite = [...w.invites.values()][0];
  w.command(a, { type: 'dungeon-enter' });
  assert.throws(() => w.command(players[3], { type: 'party-answer', id: invite.id, accept: true }), /失效/);
  assert.equal(players[3].room, 'village');
});

test('equipment gifts lock item, require recipient acceptance, and commit only once', () => {
  const w = new World(), a = w.connect(), b = w.connect(), c = w.connect();
  a.rpg.addItem('iron');
  w.command(a, { type: 'trade-offer', target: b.id, item: 'iron', quantity: 1 });
  const trade = [...w.trades.values()][0];
  assert.ok(a.rpg.inventory.includes('iron')); assert.ok(!b.rpg.inventory.includes('iron'));
  assert.throws(() => w.command(a, { type: 'equip', item: 'iron' }), /交易/);
  assert.throws(() => w.command(c, { type: 'trade-answer', id: trade.id, accept: true }), /失效/);
  w.command(b, { type: 'trade-answer', id: trade.id, accept: true });
  assert.ok(!a.rpg.inventory.includes('iron')); assert.ok(b.rpg.inventory.includes('iron'));
  assert.throws(() => w.command(b, { type: 'trade-answer', id: trade.id, accept: true }), /失效/);
  w.command(b, { type: 'equip', item: 'iron' });
  assert.throws(() => w.command(b, { type: 'trade-offer', target: a.id, item: 'iron' }), /未穿戴/);
});

test('potion gift cancellation, expiry, disconnect and stale acceptance preserve quantities', () => {
  const w = new World(), a = w.connect(), b = w.connect();
  const offer = () => { w.command(a, { type: 'trade-offer', target: b.id, item: 'potion', quantity: 2 }); return [...w.trades.values()][0]; };
  let t = offer();
  assert.throws(() => w.command(a, { type: 'potion' }), /交易/);
  w.command(a, { type: 'trade-cancel', id: t.id });
  assert.equal(a.rpg.potions, 5); assert.equal(b.rpg.potions, 5);
  t = offer(); w.tick(Date.now() + 61000);
  assert.throws(() => w.command(b, { type: 'trade-answer', id: t.id, accept: true }), /失效/);
  t = offer(); w.command(b, { type: 'trade-answer', id: t.id, accept: true });
  assert.equal(a.rpg.potions, 3); assert.equal(b.rpg.potions, 7);
  t = offer(); w.disconnect(a);
  assert.equal(w.trades.size, 0); assert.equal(a.rpg.potions, 3);
});

test('disconnect transfers party leadership, cleans empty instances and resumes same character in village', () => {
  const w = new World(), a = w.connect(), b = w.connect();
  team(w, a, b); w.command(a, { type: 'dungeon-enter' });
  const room = a.room, partyId = a.partyId;
  a.rpg.gold = 123;
  w.disconnect(a);
  assert.equal(w.parties.get(partyId).leader, b.id); assert.equal(b.room, room);
  const resumed = w.connect(a.token);
  assert.equal(resumed.id, a.id); assert.equal(resumed.rpg.gold, 123); assert.equal(resumed.room, 'village');
  w.disconnect(b); assert.equal(w.instances.size, 0);
});

test('forged combat/position commands cannot set rewards, select another instance or corrupt MP', () => {
  const w = new World(), a = w.connect(); team(w, a); w.command(a, { type: 'dungeon-enter' });
  const room = a.room;
  w.command(a, { type: 'move', x: NaN, y: 0 });
  w.command(a, { type: 'move', x: 2000, y: 400, room: 'somewhere', gold: 999999 });
  assert.equal(a.x, 140); assert.equal(a.room, room); assert.equal(a.rpg.gold, 0);
  w.command(a, { type: 'cast', skill: '__proto__', damage: 999999 });
  assert.equal(a.rpg.mp, 60);
});

test('real WebSocket clients receive snapshots, invitations and shared instance with three simultaneous connections', async t => {
  const server = createServer(), hub = attachHub(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/multiplayer`;
  const sockets = [];
  t.after(async () => { sockets.forEach(s => s.terminate()); hub.close(); await new Promise(resolve => server.close(resolve)); });
  async function client() {
    const ws = new WebSocket(url), inbox = []; sockets.push(ws);
    ws.on('message', raw => inbox.push(JSON.parse(raw)));
    await once(ws, 'open'); ws.send(JSON.stringify({ type: 'hello' }));
    return { ws, inbox, send: (type, values = {}) => ws.send(JSON.stringify({ type, ...values })) };
  }
  async function wait(c, predicate) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const found = c.inbox.find(predicate);
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail('WebSocket expected state timed out');
  }
  const a = await client(), b = await client(), c = await client();
  const sa = await wait(a, m => m.type === 'state' && m.peers.length === 2);
  const sb = await wait(b, m => m.type === 'state' && m.peers.length === 2);
  await wait(c, m => m.type === 'state' && m.peers.length === 2);
  a.send('party-create'); await wait(a, m => m.type === 'state' && m.party);
  a.send('party-invite', { target: sb.self.id });
  const invited = await wait(b, m => m.type === 'state' && m.invites.length);
  b.send('party-answer', { id: invited.invites[0].id, accept: true });
  await wait(a, m => m.type === 'state' && m.party?.members.length === 2);
  a.send('dungeon-enter');
  const enteredA = await wait(a, m => m.type === 'state' && m.self.room !== 'village');
  const enteredB = await wait(b, m => m.type === 'state' && m.self.room !== 'village');
  assert.equal(enteredA.self.room, enteredB.self.room); assert.equal(enteredB.party.leader, sa.self.id);
  assert.equal(enteredA.enemies.length, 12);
  assert.ok(await wait(c, m => m.type === 'state' && m.self.room === 'village' && m.peers.length === 0));
});

test('HTTP fallback supports two players and the same consent-based trade transaction', async t => {
  const server = createServer((req, res) => hub.http(req, res));
  const hub = attachHub(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { hub.close(); await new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/multiplayer`;
  const post = async (path, body) => {
    const response = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 200); return response.json();
  };
  const a = (await post('/connect', {}))[0], b = (await post('/connect', {}))[0];
  assert.equal((await post('/sync', { token: a.token, commands: [] }))[0].self.room, 'village');
  await new Promise(resolve => setTimeout(resolve, 40));
  const offered = await post('/sync', { token: a.token, commands: [{ type: 'trade-offer', target: b.id, item: 'potion', quantity: 2 }] });
  const trade = offered[0].trades[0];
  const received = await post('/sync', { token: b.token, commands: [{ type: 'trade-answer', id: trade.id, accept: true }] });
  assert.equal(received[0].self.rpg.potions, 7);
  await new Promise(resolve => setTimeout(resolve, 40));
  const sender = await post('/sync', { token: a.token, commands: [] });
  assert.equal(sender[0].self.rpg.potions, 3);
  await post('/leave', { token: b.token });
  assert.equal(hub.world.players.get(b.id).online, false);
});
