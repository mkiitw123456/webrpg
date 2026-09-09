import { LEDGES, HABITATS } from './world.js';
const layout = offset => LEDGES.map((p, i) => ({ ...p, x: p.x + (i % 2 ? -offset : offset), y: p.y + (i % 2 ? 20 : -12) }));
const habitats = ledges => [HABITATS[0], ledges[0], HABITATS[2], ledges[1], ledges[2], HABITATS[5], ledges[3], ledges[4], HABITATS[8], ledges[5], ledges[6], ledges[7]];
export const MAPS = {
  forest: { name: '微風森林', description: '陽光樹林 · 史萊姆與森林野豬', kinds: ['slime', 'slime', 'slime', 'boar'], ledges: LEDGES, habitats: HABITATS, tint: 0xffffff },
  cave: { name: '星晶洞窟', description: '幽暗岩洞 · 蝙蝠與苔岩巨像', kinds: ['bat', 'bat', 'golem'], ledges: layout(32), habitats: habitats(layout(32)), tint: 0x8395bd },
  mushroom: { name: '巨菇秘境', description: '巨大菇傘 · 紅帽菇菇的家園', kinds: ['mushroom'], ledges: layout(-24), habitats: habitats(layout(-24)), tint: 0xf1bbb0 }
};
