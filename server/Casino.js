import { randomInt, randomUUID } from 'node:crypto';
import { numberColor } from '../src/shared/roulette.js';
import { poolShares } from '../src/shared/pool.js';

const round = now => ({ id: randomUUID(), ends: now + 60000, bets: [] });
export function weightedWinner(bets, ticket) {
  for (const bet of bets) { if (ticket < bet.amount) return bet.player; ticket -= bet.amount; }
  throw new Error('Invalid ticket');
}
export default class Casino {
  constructor(world, now = Date.now(), rng = randomInt) {
    this.world = world; this.rng = rng;
    this.roulette = round(now); this.pool = round(now); this.rooms = new Map(); this.history = [];
  }
  debit(p, amount) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw new Error('每次金額限 1–100,000 整數金幣。');
    if (p.rpg.gold < amount) throw new Error('金幣不足。');
    p.rpg.gold -= amount;
  }
  pay(id, amount) { const p = this.world.players.get(id); if (p) { p.rpg.gold += amount; this.world.notice(p, `遊戲結算：收到 ${amount} 金幣。`); } }
  record(result) { this.history.unshift(result); this.history.length = Math.min(this.history.length, 12); }
  command(p, m, now) {
    this.world.village(p);
    if (m.type === 'casino-bet') {
      if (!['roulette', 'pool'].includes(m.game)) throw new Error('無效遊戲。');
      const r = this[m.game];
      if (m.id !== r.id || now >= r.ends - 12000) throw new Error('本局已封盤，請等待下一局。');
      if (m.game === 'roulette' && !['red', 'black', 'green'].includes(m.color)) throw new Error('請選擇紅、黑或綠。');
      if (r.bets.filter(b => b.player === p.id).length >= 20 || r.bets.length >= 500) throw new Error('本局投注次數已滿。');
      this.debit(p, m.amount);
      r.bets.push({ player: p.id, name: p.name, amount: m.amount, color: m.color }); return;
    }
    if (m.type === 'coin-create') {
      if (!['heads', 'tails'].includes(m.side)) throw new Error('請選擇正面或反面。');
      if ([...this.rooms.values()].some(r => r.status !== 'finished' && (r.owner === p.id || r.guest === p.id))) throw new Error('請先完成目前的硬幣房間。');
      if ([...this.rooms.values()].filter(r => r.status !== 'finished').length >= 100) throw new Error('房間已滿，請稍後再試。');
      this.debit(p, m.amount);
      const id = randomUUID();
      this.rooms.set(id, { id, owner: p.id, name: p.name, side: m.side, amount: m.amount, created: now, status: 'waiting', expires: now + 120000, guest: null }); return;
    }
    const r = this.rooms.get(m.id);
    if (!r) throw new Error('房間已結束。');
    if (m.type === 'coin-cancel') {
      if (r.owner !== p.id || r.guest) throw new Error('只能取消尚未配對的自己的房間。');
      this.rooms.delete(r.id); this.pay(p.id, r.amount); return;
    }
    if (m.type === 'coin-join') {
      if (m.confirmed !== true) throw new Error('請先確認加入此局與投注金額。');
      if (r.guest || r.owner === p.id || now >= r.expires) throw new Error('無法加入這個房間。');
      if ([...this.rooms.values()].some(q => q.status !== 'finished' && (q.owner === p.id || q.guest === p.id))) throw new Error('請先完成目前的硬幣房間。');
      this.debit(p, r.amount);
      r.guest = p.id; r.guestName = p.name; r.status = 'countdown'; r.joined = now; r.tossStarts = now + 10000; r.ends = r.tossStarts + 4000; return;
    }
    throw new Error('不支援的遊戲操作。');
  }
  disconnect(p) {
    for (const r of this.rooms.values()) if (r.owner === p.id && !r.guest) { this.rooms.delete(r.id); this.pay(p.id, r.amount); }
  }
  tick(now) {
    for (const game of ['roulette', 'pool']) {
      const r = this[game];
      if (game === 'roulette' && now >= r.ends - 12000 && !r.spin) {
        r.spin = { id: r.id, fromSlot: this.history.find(h => h.game === 'roulette')?.slot || 0, slot: this.rng(0, 15), starts: r.ends - randomInt(6500, 11501), ends: r.ends, turns: randomInt(6, 11), power: randomInt(30, 46) / 10 };
      }
      if (game === 'pool' && now >= r.ends - 12000 && !r.spin) {
        const shares = poolShares(r.bets), total = shares.reduce((s,b) => s+b.amount,0);
        if (shares.length >= 2) {
          const winner = weightedWinner(r.bets, this.rng(0, total));
          let preceding = 0;
          for (const share of shares) {
            if (share.player === winner) {
              const targetAngle = (preceding + share.amount * randomInt(20, 81) / 100) / total * 360;
              r.spin = { id: r.id, winner, targetAngle, starts: r.ends - randomInt(6500, 11501), ends: r.ends, turns: randomInt(6, 11), power: randomInt(30, 46) / 10 };
              break;
            }
            preceding += share.amount;
          }
        }
      }
      if (now < r.ends) continue;
      if (game === 'roulette') {
        const slot = r.spin.slot, color = numberColor(slot);
        for (const b of r.bets) if (b.color === color) this.pay(b.player, b.amount * (color === 'green' ? 14 : 2));
        this.record({ id: r.id, game, color, slot, spin: r.spin, bets: r.bets, at: now });
      } else {
        const total = r.bets.reduce((s, b) => s + b.amount, 0), players = new Set(r.bets.map(b => b.player));
        if (players.size < 2) {
          for (const b of r.bets) this.pay(b.player, b.amount);
          this.record({ id: r.id, game, refund: true, total, at: now });
        } else {
          const winner = r.spin.winner;
          this.pay(winner, total);
          this.record({ id: r.id, game, winner, name: r.bets.find(b => b.player === winner).name, total, bets: r.bets, spin: r.spin, at: now });
        }
      }
      this[game] = round(now);
    }
    for (const r of this.rooms.values()) {
      if (r.status === 'finished') { if (now >= r.removeAt) this.rooms.delete(r.id); continue; }
      if (!r.guest && now >= r.expires) { this.rooms.delete(r.id); this.pay(r.owner, r.amount); }
      else if (r.guest) {
        if (r.status === 'countdown' && now >= r.tossStarts) { r.status = 'flipping'; r.winningSide = this.rng(0, 2) === 0 ? 'heads' : 'tails'; }
        if (now >= r.ends) {
          r.status = 'finished'; r.finishedAt = now; r.removeAt = now + 1800000;
          r.winner = r.winningSide === r.side ? r.owner : r.guest;
          this.pay(r.winner, r.amount * 2);
          this.record({ id: r.id, game: 'coin', side: r.winningSide, winner: r.winner, name: r.winner === r.owner ? r.name : r.guestName, total: r.amount * 2, at: now });
        }
      }
    }
  }
  snapshot(p) {
    return { roulette: this.roulette, pool: this.pool, rooms: [...this.rooms.values()], history: this.history };
  }
}
