export const LEDGES = [
  { x: 288, y: 380, width: 192 }, { x: 568, y: 292, width: 224 },
  { x: 900, y: 372, width: 192 }, { x: 1200, y: 284, width: 224 },
  { x: 1512, y: 372, width: 224 }, { x: 1840, y: 284, width: 224 },
  { x: 2176, y: 372, width: 192 }, { x: 2496, y: 292, width: 224 }
];
export const HABITATS = [
  { x: 180, y: 476, width: 220 }, LEDGES[0],
  { x: 600, y: 476, width: 260 }, LEDGES[1], LEDGES[2],
  { x: 1130, y: 476, width: 280 }, LEDGES[3], LEDGES[4],
  { x: 1800, y: 476, width: 280 }, LEDGES[5], LEDGES[6], LEDGES[7]
];
export function intersectsAttack(player, enemy, skill, spin) {
  const left = spin ? player.x - skill.range : player.flipX ? player.x - skill.range : player.x;
  const right = spin ? player.x + skill.range : player.flipX ? player.x : player.x + skill.range;
  return enemy.x + 24 >= left && enemy.x - 24 <= right && Math.abs(enemy.y - player.y) <= skill.height / 2 + 18;
}
