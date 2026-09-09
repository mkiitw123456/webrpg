import { CLASS_SKILLS, STARTER } from '../shared/classes.js';
export const ITEMS = {
  bow: {name:'新手短弓',starter:true,classId:'archer',level:1,slot:'weapon',attack:0,defense:0,color:0xc9a571,description:'免費領取的入門短弓。'},
  staff: {name:'新手法杖',starter:true,classId:'mage',level:1,slot:'weapon',attack:0,defense:0,color:0xa5dcff,description:'免費領取的冰晶法杖。'},
  claw: {name:'新手拳套',starter:true,classId:'rogue',level:1,slot:'weapon',attack:0,defense:0,color:0xcab1e5,description:'免費領取的飛鏢拳套。'},
  longbow: {name:'翠葉長弓',classId:'archer',level:4,slot:'weapon',attack:16,defense:0,color:0x9bea9c,description:'精製長弓，攻擊 +16。'},
  froststaff: {name:'星晶法杖',classId:'mage',level:4,slot:'weapon',attack:16,defense:0,color:0x80dbfa,description:'凝聚魔力，攻擊 +16。'},
  shadowclaw: {name:'月影拳套',classId:'rogue',level:4,slot:'weapon',attack:16,defense:0,color:0xb6a2e8,description:'迅捷投擲，攻擊 +16。'},
  wood: { name: '練習木劍', slot: 'weapon', attack: 0, defense: 0, color: 0xb98750, description: '陪你踏出第一步的木劍。' },
  iron: { name: '草原鐵劍', slot: 'weapon', attack: 8, defense: 0, color: 0xd4ecf4, description: '鋒利的鐵刃，攻擊 +8。' },
  leaf: { name: '翠葉長劍', slot: 'weapon', attack: 16, defense: 0, color: 0x9bea9c, description: '凝聚草原氣息，攻擊 +16。' },
  shirt: { name: '旅行布衣', slot: 'armor', attack: 0, defense: 0, color: 0xffffff, description: '輕便的新手服裝。' },
  vest: { name: '守林皮甲', slot: 'armor', attack: 0, defense: 4, color: 0xc8e3ad, description: '堅韌的皮革，防禦 +4。' },
  copper: { name: '赤銅巨劍', level: 3, slot: 'weapon', attack: 12, defense: 0, color: 0xe69762, description: '菇菇掉落的厚重銅刃，攻擊 +12。' },
  moon: { name: '月影長衣', level: 4, slot: 'armor', attack: 0, defense: 8, color: 0xb6a2e8, description: '紫翼蝙蝠掉落，防禦 +8。' },
  plate: { name: '獠牙鎧甲', level: 5, slot: 'armor', attack: 0, defense: 12, color: 0x9faeba, description: '森林野豬掉落，防禦 +12。' },
  crystal: { name: '星晶大劍', level: 7, slot: 'weapon', attack: 28, defense: 0, color: 0x80dbfa, description: '苔岩巨像掉落的稀有武器，攻擊 +28。' }
};
Object.assign(ITEMS.wood, { level: 1, starter: true });
for (const item of Object.values(ITEMS)) if(item.slot==='weapon'&&!item.classId)item.classId='warrior';
Object.assign(ITEMS.shirt, { level: 1 });
Object.assign(ITEMS.iron, { level: 2 });
Object.assign(ITEMS.vest, { level: 2 });
Object.assign(ITEMS.leaf, { level: 4 });

export const SKILLS = {
  attack: { name: '揮劍', key: 'J', mp: 0, cooldown: 380, range: 86, height: 72, multiplier: 1, color: 0xffe8a3 },
  wave: { name: '翠葉劍氣', key: 'K', mp: 10, cooldown: 1600, range: 260, height: 88, multiplier: 1.6, color: 0x9bffd3 },
  spin: { name: '旋風斬', key: 'L', mp: 18, cooldown: 3600, range: 125, height: 130, multiplier: 2.2, color: 0xffd68c }
};

export default class RPGState {
  constructor(classId = 'warrior') {
    this.classId = Object.hasOwn(STARTER,classId) ? classId : 'warrior';
    this.level = 1;
    this.exp = 0;
    this.gold = 0;
    this.kills = 0;
    this.potions = 5;
    this.skillPoints = 0;
    this.ranks = { wave: 1, spin: 1 };
    this.inventory = [STARTER[this.classId], 'shirt', 'vest'];
    this.enhancements = {};
    this.equipment = { weapon: STARTER[this.classId], armor: 'shirt' };
    this.cooldowns = { attack: 0, wave: 0, spin: 0 };
    this.globalCooldown = 0;
    this.potionReady = 0;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }
  get skills() { return CLASS_SKILLS[this.classId] || SKILLS; }
  get maxHp() { return 100 + (this.level - 1) * 20; }
  get maxMp() { return 60 + (this.level - 1) * 8; }
  get nextExp() { return this.level * 60; }
  get attack() { return 12 + (this.level - 1) * 3 + (ITEMS[this.equipment.weapon]?.attack || 0) + (this.enhancements[this.equipment.weapon] || 0) * 3; }
  get defense() { return 2 + this.level - 1 + (ITEMS[this.equipment.armor]?.defense || 0) + (this.enhancements[this.equipment.armor] || 0) * 2; }
  equip(id) {
    if (!this.inventory.includes(id) || !ITEMS[id] || (ITEMS[id].classId && ITEMS[id].classId !== this.classId)) return false;
    this.equipment[ITEMS[id].slot] = id;
    return true;
  }
  addItem(id) {
    if (!ITEMS[id] || this.inventory.includes(id)) return false;
    this.inventory.push(id);
    return true;
  }
  upgrade(id) {
    if (this.skills[id]?.passive || !Object.hasOwn(this.ranks, id) || this.ranks[id] >= 5 || this.skillPoints < 1) return false;
    this.skillPoints--;
    this.ranks[id]++;
    return true;
  }
  multiplier(id) { return this.skills[id].multiplier + ((this.ranks[id] || 1) - 1) * 0.35; }
  cast(id, now) {
    if (!Object.hasOwn(SKILLS, id)) return false;
    const skill = this.skills[id];
    if (!skill || skill.passive || this.hp <= 0 || now < this.cooldowns[id] || now < this.globalCooldown || this.mp < skill.mp) return false;
    this.mp -= skill.mp;
    this.cooldowns[id] = now + skill.cooldown;
    this.globalCooldown = now + 260;
    return true;
  }
  gainExp(amount) {
    this.exp += amount;
    let levels = 0;
    while (this.exp >= this.nextExp) {
      this.exp -= this.nextExp;
      this.level++;
      this.skillPoints++;
      levels++;
    }
    if (levels) { this.hp = this.maxHp; this.mp = this.maxMp; }
    return levels;
  }
  damage(raw) {
    const amount = Math.max(1, raw - this.defense);
    this.hp = Math.max(0, this.hp - amount);
    return amount;
  }
  potion(now) {
    if (!this.potions || this.hp <= 0 || now < this.potionReady || (this.hp === this.maxHp && this.mp === this.maxMp)) return false;
    this.potions--;
    this.hp = Math.min(this.maxHp, this.hp + 60);
    this.mp = Math.min(this.maxMp, this.mp + 30);
    this.potionReady = now + 1000;
    return true;
  }
}
