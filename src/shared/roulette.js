export const REEL = [0, 11, 5, 10, 6, 9, 7, 8, 1, 14, 2, 13, 3, 12, 4];
export const numberColor = n => n === 0 ? 'green' : n <= 7 ? 'red' : 'black';
export function reelPosition(spin, now) {
  const t = Math.max(0, Math.min(1, (now - spin.starts) / (spin.ends - spin.starts)));
  const start = REEL.indexOf(spin.fromSlot || 0);
  const distance = spin.turns * 15 + REEL.indexOf(spin.slot) - start;
  return start + distance * (1 - (1 - t) ** spin.power);
}
