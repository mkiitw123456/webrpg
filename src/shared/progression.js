export const MONSTERS = {
  slime: { name: '草葉史萊姆', hp: 36, speed: 55, damage: 14, loot: 'iron' },
  mushroom: { name: '紅帽菇菇', hp: 52, speed: 42, damage: 17, loot: 'copper' },
  bat: { name: '紫翼蝙蝠', hp: 44, speed: 90, damage: 16, loot: 'moon' },
  boar: { name: '森林野豬', hp: 80, speed: 65, damage: 22, loot: 'plate' },
  golem: { name: '苔岩巨像', hp: 120, speed: 28, damage: 28, loot: 'crystal' }
};
export const monsterKind = index => Object.keys(MONSTERS)[index % 5];
export const FORGE_SUCCESS=[100,95,90,85,80,75,70,65,60,50,40,30,20,10,5];
export const FORGE_DESTROY=[0,0,0,0,0,0,10,15,20,25,30,30,30,30,30];
export function forgeRules(item, enhancement = 0) {
  return { successRate:FORGE_SUCCESS[enhancement]||0, destroyRate:FORGE_DESTROY[enhancement]||0, cost: 25 * (item.level || 1) * (enhancement + 1) ** 2 };
}

export function scaledMonster(kind,level) { const m=MONSTERS[kind],n=Math.max(1,level); return {level:n,hp:Math.round(m.hp*(1+(n-1)*0.22)),maxHp:Math.round(m.hp*(1+(n-1)*0.22)),damage:Math.round(m.damage*(1+(n-1)*0.09)),exp:Math.round((25+m.hp/10)*n**1.15),gold:Math.round(12*n**1.1),dropRate:Math.min(80,25+(n-1)*2)}; }
