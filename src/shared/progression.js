export const MONSTERS = {
  slime: { name: '草葉史萊姆', hp: 36, speed: 55, damage: 14, loot: 'iron' },
  mushroom: { name: '紅帽菇菇', hp: 52, speed: 42, damage: 17, loot: 'copper' },
  bat: { name: '紫翼蝙蝠', hp: 44, speed: 90, damage: 16, loot: 'moon' },
  boar: { name: '森林野豬', hp: 80, speed: 65, damage: 22, loot: 'plate' },
  golem: { name: '苔岩巨像', hp: 120, speed: 28, damage: 28, loot: 'crystal' }
};
export const monsterKind = index => Object.keys(MONSTERS)[index % 5];
export function forgeRules(item, enhancement = 0) {
  const difficulty = (item.level || 1) + enhancement;
  return { cost: 25 * (item.level || 1) * (enhancement + 1) ** 2,
    successMin: Math.max(2, 13 - difficulty), successMax: Math.max(5, 26 - difficulty),
    failureMin: 2 + difficulty, failureMax: 9 + difficulty * 2 };
}
