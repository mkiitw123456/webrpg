import { randomInt, randomUUID } from 'node:crypto';
import { ITEMS } from '../src/systems/RPGState.js';
import { forgeRules } from '../src/shared/progression.js';

export default class Forge {
  constructor(world, rng = randomInt) { this.world = world; this.rng = rng; }
  start(p, item, now) {
    this.world.village(p);
    if (p.forge?.status === 'running') throw new Error('正在強化中，請等待結果。');
    if (!Object.hasOwn(ITEMS, item) || !p.rpg.inventory.includes(item) || this.world.locked(p, item)) throw new Error('裝備不存在或正在交易。');
    const level = p.rpg.enhancements[item] || 0, rules = forgeRules(ITEMS[item], level);
    if (level >= 10) throw new Error('裝備已達 +10 上限。');
    if (p.rpg.gold < rules.cost) throw new Error(`金幣不足，需要 ${rules.cost} 金幣。`);
    p.rpg.gold -= rules.cost;
    p.forge = { id: randomUUID(), item, level, cost: rules.cost, rules, phase: 'upgrade', success: 0, failure: 0, segments: [], status: 'running', nextTick: now };
  }
  finish(p, status) {
    const f = p.forge;
    f.status = status;
    if (status === 'success') p.rpg.enhancements[f.item] = f.level + 1;
    if (status === 'destroyed') {
      p.rpg.inventory = p.rpg.inventory.filter(id => id !== f.item);
      delete p.rpg.enhancements[f.item];
      for (const slot of Object.keys(p.rpg.equipment)) if (p.rpg.equipment[slot] === f.item) p.rpg.equipment[slot] = null;
    }
    this.world.notice(p, `${ITEMS[f.item].name} ${status === 'success' ? '強化成功！+' + (f.level + 1) : status === 'destroyed' ? '爆裝！裝備已損毀。' : '強化失敗，保留原等級。'}`);
  }
  tick(now) {
    for (const p of this.world.players.values()) {
      const f = p.forge;
      if (!f || f.status !== 'running') continue;
      // The authoritative result commits only after the visible growth finishes.
      if (f.step?.outcome && now >= f.step.ends) {
        const won = f.step.outcome === 'top'; f.step.outcome = null;
        if (f.phase === 'risk') { this.finish(p, won ? 'failure' : 'destroyed'); continue; }
        if (won) { this.finish(p, 'success'); continue; }
        if (f.level <= 6) { this.finish(p, 'failure'); continue; }
        f.pendingRisk = true;
      }
      if (now < f.nextTick) continue;
      if (f.pendingRisk) {
        f.phase = 'risk'; f.pendingRisk = false; f.success = 0; f.failure = 0; f.segments = [];
      }
      const risk = f.phase === 'risk';
      const base = this.rng(risk ? 8 : f.rules.successMin, risk ? 23 : f.rules.successMax + 1);
      const boosted = !risk && this.rng(0, 10) === 0;
      const a = base * (boosted ? 2 : 1), b = this.rng(risk ? 5 : f.rules.failureMin, risk ? 19 : f.rules.failureMax + 1);
      const topTime = (100 - f.success) / a, bottomTime = (100 - f.failure) / b;
      const fraction = Math.min(1, topTime, bottomTime), fromSuccess = f.success, fromFailure = f.failure;
      f.success = Math.min(100, f.success + a * fraction); f.failure = Math.min(100, f.failure + b * fraction);
      const crossed = topTime <= 1 || bottomTime <= 1;
      const topWins = crossed && (topTime === bottomTime ? this.rng(0, 2) === 0 : topTime < bottomTime);
      f.segments.push({ from: fromSuccess, to: f.success, boosted });
      f.step = { starts: now, ends: now + 350, fromSuccess, fromFailure, base, boosted, outcome: crossed ? topWins ? 'top' : 'bottom' : null };
      f.nextTick = now + 850; // 350ms growth + 500ms pause, including the final risk handoff.
    }
  }
}
