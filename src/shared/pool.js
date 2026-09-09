export function poolShares(bets) {
  const players = new Map();
  for (const b of bets) {
    if (!players.has(b.player)) players.set(b.player, { player: b.player, name: b.name, amount: 0 });
    players.get(b.player).amount += b.amount;
  }
  return [...players.values()];
}
export function poolAngle(spin, now) {
  if (!spin) return 0;
  const t = Math.max(0, Math.min(1, (now - spin.starts) / (spin.ends - spin.starts)));
  return (spin.turns * 360 - spin.targetAngle) * (1 - (1 - t) ** spin.power);
}
