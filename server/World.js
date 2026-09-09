import { randomUUID, randomBytes } from 'node:crypto';
import RPGState, { ITEMS, SKILLS } from '../src/systems/RPGState.js';
import { intersectsAttack } from '../src/shared/world.js';
import { MONSTERS } from '../src/shared/progression.js';
import Forge from './Forge.js';
import Casino from './Casino.js';
import { MAPS } from '../src/shared/maps.js';

export default class World {
  constructor() {
    this.players = new Map();
    this.tokens = new Map();
    this.parties = new Map();
    this.instances = new Map();
    this.invites = new Map();
    this.trades = new Map();
    this.events = [];
    this.forge = new Forge(this);
    this.casino = new Casino(this);
  }
  connect(token, now = Date.now()) {
    let p = this.players.get(this.tokens.get(token));
    if (p?.online) throw new Error('這個角色已在另一個連線使用。');
    if (!p) {
      const id = randomUUID();
      p = { id, token: randomBytes(24).toString('hex'), name: `冒險者 ${id.slice(0, 4)}`, rpg: new RPGState(), partyId: null, room: 'village', x: 140, y: 449, flipX: false, moving: false, online: true, hurtUntil: 0, reviveAt: 0, moveAt: now, teleport: 0 };
      this.players.set(id, p);
      this.tokens.set(p.token, id);
    }
    p.online = true;
    p.moveAt = now;
    return p;
  }
  publicPlayer(p) { return { id: p.id, name: p.name, x: p.x, y: p.y, flipX: p.flipX, moving: p.moving, level: p.rpg.level, hp: p.rpg.hp, maxHp: p.rpg.maxHp, weapon: p.rpg.equipment.weapon, armor: p.rpg.equipment.armor, partyId: p.partyId, online: p.online }; }
  snapshot(p, now) {
    const party = this.parties.get(p.partyId);
    const instance = this.instances.get(p.room);
    return {
      type: 'state', now, mapId: instance?.mapId || 'village', self: { ...this.publicPlayer(p), room: p.room, teleport: p.teleport, rpg: p.rpg },
      peers: [...this.players.values()].filter(q => q.online && q.id !== p.id && q.room === p.room).map(q => this.publicPlayer(q)),
      party: party ? { id: party.id, leader: party.leader, members: party.members.map(id => this.publicPlayer(this.players.get(id))) } : null,
      invites: [...this.invites.values()].filter(i => i.to === p.id || i.from === p.id),
      trades: [...this.trades.values()].filter(t => t.to === p.id || t.from === p.id),
      forge: p.forge || null, casino: p.room === 'village' ? this.casino.snapshot(p) : null,
      enemies: instance ? instance.enemies.map(e => ({ id: e.id, index: e.index, kind: e.kind, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, direction: e.direction })) : [],
      drops: instance ? instance.drops : []
    };
  }
  event(room, payload) { this.events.push({ room, ...payload }); }
  notice(p, text) { this.events.push({ to: p.id, type: 'notice', text }); }
  village(p) { if (p.room !== 'village') throw new Error('請先回村莊再進行這個操作。'); }
  partyOf(p) {
    const party = this.parties.get(p.partyId);
    if (!party) throw new Error('請先建立隊伍。');
    return party;
  }
  locked(p, item) { return (p.forge?.status === 'running' && p.forge.item === item) || [...this.trades.values()].some(t => t.from === p.id && t.item === item); }
  travel(p, room, index = 0) {
    p.room = room; p.x = 140 + index * 44; p.y = 449; p.moving = false;
    p.teleport++; p.hurtUntil = Date.now() + 2000; p.moveAt = Date.now();
  }
  cleanRoom(room) {
    if (room !== 'village' && ![...this.players.values()].some(p => p.online && p.room === room)) this.instances.delete(room);
  }
  cancelPending(id) {
    for (const [key, i] of this.invites) if (i.from === id || i.to === id) this.invites.delete(key);
    for (const [key, t] of this.trades) if (t.from === id || t.to === id) this.trades.delete(key);
  }
  leave(p) {
    const room = p.room;
    const party = this.parties.get(p.partyId);
    this.cancelPending(p.id);
    if (party) {
      party.members = party.members.filter(id => id !== p.id);
      if (!party.members.length) this.parties.delete(party.id);
      else if (party.leader === p.id) party.leader = party.members[0];
    }
    p.partyId = null;
    this.travel(p, 'village');
    this.cleanRoom(room);
  }
  disconnect(p) {
    this.casino.disconnect(p);
    this.leave(p);
    p.online = false;
    p.disconnectedAt = Date.now();
  }
  command(p, m, now = Date.now()) {
    if (!p.online) return;
    switch (m.type) {
      case 'forge': return this.forge.start(p, m.item, now);
      case 'casino-bet': case 'coin-create': case 'coin-join': case 'coin-cancel': return this.casino.command(p, m, now);
      case 'move': {
        if (p.rpg.hp <= 0 || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
        const dt = Math.min(0.25, Math.max(0.016, (now - p.moveAt) / 1000));
        const width = p.room === 'village' ? 1440 : 2880;
        if (Math.abs(m.x - p.x) > 300 * dt + 24 || Math.abs(m.y - p.y) > 750 * dt + 30) {
          p.teleport++; return;
        }
        p.x = Math.max(15, Math.min(width - 15, m.x));
        p.y = Math.max(30, Math.min(449, m.y));
        p.flipX = !!m.flipX; p.moving = !!m.moving; p.moveAt = now;
        return;
      }
      case 'name': {
        this.village(p);
        const name = typeof m.name === 'string' ? m.name.trim().slice(0, 16) : '';
        if (!name || /[<>\x00-\x1f]/.test(name)) throw new Error('請輸入 1–16 個字的角色名稱。');
        p.name = name; return;
      }
      case 'equip': {
        if (this.locked(p, m.item) || this.locked(p, p.rpg.equipment[ITEMS[m.item]?.slot])) throw new Error('此裝備正在強化或交易，請先等待完成。');
        if (!p.rpg.equip(m.item)) throw new Error('背包中沒有這件裝備。');
        return;
      }
      case 'unequip': {
        if (!['weapon', 'armor'].includes(m.slot)) return;
        if (this.locked(p, p.rpg.equipment[m.slot])) throw new Error('裝備正在強化或交易。');
        p.rpg.equipment[m.slot] = null; return;
      }
      case 'upgrade': p.rpg.upgrade(m.skill); return;
      case 'potion': {
        if (this.locked(p, 'potion')) throw new Error('藥水正在交易，請先完成或取消交易。');
        if (p.rpg.potion(now)) this.notice(p, '使用藥水：HP +60、MP +30。');
        return;
      }
      case 'cast': return this.cast(p, m.skill, now);
      case 'party-create': {
        this.village(p);
        if (p.partyId) throw new Error('你已在隊伍中。');
        const id = randomUUID();
        this.parties.set(id, { id, leader: p.id, members: [p.id] }); p.partyId = id; return;
      }
      case 'party-invite': {
        this.village(p);
        const party = this.partyOf(p), target = this.players.get(m.target);
        if (party.leader !== p.id) throw new Error('只有隊長可以邀請隊員。');
        if (party.members.length >= 4) throw new Error('隊伍最多 4 人。');
        if (!target?.online || target.id === p.id || target.partyId || target.room !== 'village') throw new Error('對方目前無法加入隊伍。');
        for (const i of this.invites.values()) if (i.from === p.id && i.to === target.id) return;
        const id = randomUUID();
        this.invites.set(id, { id, from: p.id, fromName: p.name, to: target.id, partyId: party.id, expires: now + 60000 }); return;
      }
      case 'party-answer': {
        const i = this.invites.get(m.id);
        if (!i || i.to !== p.id) throw new Error('邀請已失效。');
        this.invites.delete(i.id);
        if (!m.accept) return;
        this.village(p);
        const party = this.parties.get(i.partyId);
        if (i.expires < now || p.partyId || !party || party.members.length >= 4 || !party.members.every(id => this.players.get(id)?.room === 'village')) throw new Error('隊伍已出發或邀請已失效。');
        party.members.push(p.id); p.partyId = party.id; this.cancelPending(p.id); return;
      }
      case 'party-leave': this.leave(p); return;
      case 'dungeon-enter': {
        this.village(p);
        const mapId = m.mapId ?? 'forest';
        if (!Object.hasOwn(MAPS, mapId)) throw new Error('請選擇有效的副本地圖。');
        const map = MAPS[mapId];
        const party = this.partyOf(p);
        if (party.leader !== p.id) throw new Error('由隊長帶隊進入副本。');
        const members = party.members.map(id => this.players.get(id));
        if (!members.every(q => q.online && q.room === 'village' && q.rpg.hp > 0)) throw new Error('請等所有隊員回到村莊。');
        if (members.some(q => q.forge?.status === 'running')) throw new Error('請等待隊員強化完成。');
        if ([...this.trades.values()].some(t => party.members.includes(t.from) || party.members.includes(t.to))) throw new Error('請先完成或取消交易再出發。');
        const id = randomUUID();
        this.instances.set(id, { id, mapId, partyId: party.id, drops: [], enemies: map.habitats.map((h, index) => { const kind = map.kinds[index % map.kinds.length]; return { id: randomUUID(), index, kind, x: h.x + h.width / 2, y: h.y - (kind === 'slime' ? 16 : 28), left: h.x + 26, right: h.x + h.width - 26, direction: 1, hp: MONSTERS[kind].hp, maxHp: MONSTERS[kind].hp, respawnAt: 0 }; }) });
        members.forEach((q, i) => { this.cancelPending(q.id); this.travel(q, id, i); }); return;
      }
      case 'dungeon-return': {
        const party = this.partyOf(p);
        if (party.leader !== p.id) throw new Error('由隊長帶隊回村；也可離隊自行回村。');
        const room = p.room;
        party.members.forEach(id => this.travel(this.players.get(id), 'village'));
        this.cleanRoom(room); return;
      }
      case 'trade-offer': {
        this.village(p);
        if (this.locked(p, m.item)) throw new Error('物品正在強化或交易。');
        const target = this.players.get(m.target);
        if (!target?.online || target.room !== 'village' || target.id === p.id) throw new Error('請選擇村莊中的其他玩家。');
        if ([...this.trades.values()].some(t => t.from === p.id)) throw new Error('請先完成或取消上一筆贈送。');
        const quantity = m.item === 'potion' ? m.quantity : 1;
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('數量必須介於 1–99。');
        if (m.item === 'potion' ? p.rpg.potions < quantity : !ITEMS[m.item] || !p.rpg.inventory.includes(m.item) || Object.values(p.rpg.equipment).includes(m.item)) throw new Error('只能贈送背包中未穿戴的物品。');
        if (m.item !== 'potion' && target.rpg.inventory.includes(m.item)) throw new Error('對方已擁有同款裝備。');
        const id = randomUUID();
        this.trades.set(id, { id, from: p.id, fromName: p.name, to: target.id, toName: target.name, item: m.item, quantity, expires: now + 60000 }); return;
      }
      case 'trade-answer': {
        const t = this.trades.get(m.id);
        if (!t || t.to !== p.id) throw new Error('交易已失效。');
        this.trades.delete(t.id);
        if (!m.accept) return;
        const from = this.players.get(t.from);
        if (t.expires < now || !from?.online || from.room !== 'village' || p.room !== 'village') throw new Error('雙方必須在線且位於村莊。');
        if (t.item === 'potion') {
          if (from.rpg.potions < t.quantity) throw new Error('對方藥水不足。');
          from.rpg.potions -= t.quantity; p.rpg.potions += t.quantity;
        } else {
          if (!from.rpg.inventory.includes(t.item) || Object.values(from.rpg.equipment).includes(t.item) || p.rpg.inventory.includes(t.item)) throw new Error('物品狀態已改變，交易取消。');
          from.rpg.inventory.splice(from.rpg.inventory.indexOf(t.item), 1);
          p.rpg.inventory.push(t.item);
          p.rpg.enhancements[t.item] = from.rpg.enhancements[t.item] || 0;
          delete from.rpg.enhancements[t.item];
        }
        this.notice(p, `收到 ${t.fromName} 的 ${ITEMS[t.item]?.name || '恢復藥水'} ×${t.quantity}。`);
        this.notice(from, `${p.name} 已接受贈送，物品已移交。`); return;
      }
      case 'trade-cancel': {
        const t = this.trades.get(m.id);
        if (t?.from === p.id) this.trades.delete(t.id);
        return;
      }
      default: throw new Error('不支援的操作。');
    }
  }
  cast(p, skillId, now) {
    if (!Object.hasOwn(SKILLS, skillId)) return;
    const skill = SKILLS[skillId];
    if (!skill || p.room === 'village' || !p.rpg.cast(skillId, now)) return;
    const instance = this.instances.get(p.room);
    if (!instance) return;
    const hits = [];
    for (const enemy of instance.enemies) {
      if (enemy.hp <= 0 || !intersectsAttack(p, enemy, skill, skillId === 'spin')) continue;
      const damage = Math.round(p.rpg.attack * p.rpg.multiplier(skillId));
      enemy.hp = Math.max(0, enemy.hp - damage);
      hits.push({ id: enemy.id, x: enemy.x, y: enemy.y, damage });
      if (!enemy.hp) {
        enemy.respawnAt = now + 5000;
        const first = p.rpg.kills === 0;
        for (const q of this.players.values()) {
          if (!q.online || q.room !== p.room) continue;
          q.rpg.kills++;
          if (q.rpg.gainExp(25 + enemy.index * 3)) this.notice(q, `升級！Lv.${q.rpg.level}，獲得 1 技能點。`);
          if (q.rpg.kills === 5) { q.rpg.addItem('leaf'); q.rpg.gold += 80; this.notice(q, '草原初戰完成！獲得翠葉長劍與 80 金幣。'); }
        }
        instance.drops.push({ id: randomUUID(), x: enemy.x, y: enemy.y, gold: 12 + enemy.index * 2, potion: p.rpg.kills % 2 === 0, item: first ? 'iron' : MONSTERS[enemy.kind]?.loot || null });
      }
    }
    this.event(p.room, { type: 'attack', player: p.id, skill: skillId, x: p.x, y: p.y, direction: p.flipX ? -1 : 1, hits });
  }
  tick(now = Date.now(), dt = 0.05) {
    this.forge.tick(now); this.casino.tick(now);
    for (const [id, value] of this.invites) if (value.expires <= now) this.invites.delete(id);
    for (const [id, value] of this.trades) if (value.expires <= now) this.trades.delete(id);
    for (const instance of this.instances.values()) {
      for (const e of instance.enemies) {
        if (!e.hp) { if (now >= e.respawnAt) { e.hp = e.maxHp; e.x = (e.left + e.right) / 2; } else continue; }
        e.x += e.direction * (MONSTERS[e.kind]?.speed || 55) * dt;
        if (e.x >= e.right) { e.x = e.right; e.direction = -1; }
        if (e.x <= e.left) { e.x = e.left; e.direction = 1; }
      }
    }
    for (const p of this.players.values()) {
      if (!p.online) {
        if (now - p.disconnectedAt > 86400000) { this.tokens.delete(p.token); this.players.delete(p.id); }
        continue;
      }
      if (p.rpg.hp <= 0) {
        if (now >= p.reviveAt) { p.rpg.hp = p.rpg.maxHp; p.rpg.mp = p.rpg.maxMp; this.travel(p, p.room); this.notice(p, '已復活，保留裝備與經驗。'); }
        continue;
      }
      p.rpg.mp = Math.min(p.rpg.maxMp, p.rpg.mp + dt * 4);
      if (p.room === 'village') { p.rpg.hp = Math.min(p.rpg.maxHp, p.rpg.hp + dt * 8); continue; }
      const instance = this.instances.get(p.room);
      if (!instance) continue;
      if (now >= p.hurtUntil) {
        const e = instance.enemies.find(e => e.hp > 0 && Math.abs(e.x - p.x) < 32 && Math.abs(e.y - p.y) < 34);
        if (e) {
          const damage = p.rpg.damage(MONSTERS[e.kind]?.damage || 14);
          p.hurtUntil = now + 1000;
          this.event(p.room, { type: 'hurt', player: p.id, x: p.x, y: p.y, damage });
          if (!p.rpg.hp) { p.reviveAt = now + 2000; this.notice(p, '你倒下了，2 秒後在副本入口復活。'); }
        }
      }
      if (p.rpg.hp <= 0) continue;
      for (const drop of [...instance.drops]) {
        if (Math.hypot(p.x - drop.x, p.y - drop.y) > 82) continue;
        // 先移除掉落物再給獎勵；同一 tick 的下一位玩家無法重複領取。
        instance.drops.splice(instance.drops.indexOf(drop), 1);
        p.rpg.gold += drop.gold;
        if (drop.potion) p.rpg.potions++;
        if (drop.item) p.rpg.addItem(drop.item);
        this.notice(p, `拾取 ${drop.gold} 金幣${drop.item ? '、' + ITEMS[drop.item].name : ''}${drop.potion ? '、恢復藥水' : ''}。`);
      }
    }
  }
}
